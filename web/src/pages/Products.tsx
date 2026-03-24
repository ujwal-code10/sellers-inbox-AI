import { useState, useEffect } from 'react'
import { api, Product, Variant } from '../services/api'

interface VariantRow {
  color: string
  size: string
  available: boolean
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, Variant[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)

  // Add product form
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  // Variant grid generator
  const [showVariantGrid, setShowVariantGrid] = useState<number | null>(null)
  const [gridColors, setGridColors] = useState('')
  const [gridSizes, setGridSizes] = useState('')
  const [gridVariants, setGridVariants] = useState<VariantRow[]>([])
  const [gridGenerated, setGridGenerated] = useState(false)
  const [savingVariants, setSavingVariants] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const productsData = await api.getProducts()
      setProducts(productsData)

      // Fetch all variants in parallel instead of sequentially
      const variantPromises = productsData.map(product =>
        api.getVariants(product.id).then(variants => ({
          productId: product.id,
          variants
        }))
      )

      const variantResults = await Promise.all(variantPromises)

      // Build the variants map from parallel results
      const variantsMap: Record<number, Variant[]> = {}
      variantResults.forEach(result => {
        variantsMap[result.productId] = result.variants
      })

      setVariantsByProduct(variantsMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ── Generate variant grid from colors × sizes ──
  const handleGenerateGrid = () => {
    const colors = gridColors.split(',').map(c => c.trim()).filter(Boolean)
    const sizes = gridSizes.split(',').map(s => s.trim()).filter(Boolean)

    if (colors.length === 0 || sizes.length === 0) return

    const combinations: VariantRow[] = []
    for (const color of colors) {
      for (const size of sizes) {
        combinations.push({ color, size, available: true })
      }
    }
    setGridVariants(combinations)
    setGridGenerated(true)
  }

  const toggleGridVariant = (index: number) => {
    setGridVariants(prev =>
      prev.map((v, i) => i === index ? { ...v, available: !v.available } : v)
    )
  }

  const handleMarkAllGrid = (available: boolean) => {
    setGridVariants(prev => prev.map(v => ({ ...v, available })))
  }

  const handleSaveVariants = async (productId: number) => {
    if (gridVariants.length === 0) return
    setSavingVariants(true)
    try {
      for (const v of gridVariants) {
        await api.createVariant(productId, v.color, v.size, v.available)
      }
      const updated = await api.getVariants(productId)
      setVariantsByProduct(prev => ({ ...prev, [productId]: updated }))
      setShowVariantGrid(null)
      setGridColors('')
      setGridSizes('')
      setGridVariants([])
      setGridGenerated(false)
    } catch (err) {
      setError('Failed to save variants')
    } finally {
      setSavingVariants(false)
    }
  }

  const handleResetGrid = () => {
    setGridColors('')
    setGridSizes('')
    setGridVariants([])
    setGridGenerated(false)
  }

  // ── Add product ──
  const handleAddProduct = async () => {
    if (!newName.trim() || !newPrice) return
    setAddingProduct(true)
    try {
      const product = await api.createProduct(
        newName.trim(),
        parseFloat(newPrice),
        newKeywords.trim() || undefined,
        newNotes.trim() || undefined
      )
      setProducts([product, ...products])
      setVariantsByProduct({ ...variantsByProduct, [product.id]: [] })
      setNewName(''); setNewPrice(''); setNewKeywords(''); setNewNotes('')
      setShowAddProduct(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setAddingProduct(false)
    }
  }

  // ── Delete product ──
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product and all its variants?')) return
    try {
      await api.deleteProduct(id)
      setProducts(products.filter(p => p.id !== id))
      const updated = { ...variantsByProduct }
      delete updated[id]
      setVariantsByProduct(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  // ── Toggle variant availability — instant, no confirmation ──
  const handleToggleVariant = async (variant: Variant) => {
    // Optimistic update — change UI immediately
    setVariantsByProduct(prev => ({
      ...prev,
      [variant.product_id]: prev[variant.product_id].map(v =>
        v.id === variant.id ? { ...v, available: !v.available } : v
      )
    }))
    try {
      await api.updateVariant(variant.id, !variant.available)
    } catch (err) {
      // Revert on failure
      setVariantsByProduct(prev => ({
        ...prev,
        [variant.product_id]: prev[variant.product_id].map(v =>
          v.id === variant.id ? { ...v, available: variant.available } : v
        )
      }))
      setError('Failed to update variant')
    }
  }

  // ── Mark all variants for a product ──
  const handleMarkAll = async (productId: number, available: boolean) => {
    const variants = variantsByProduct[productId] || []
    // Optimistic update
    setVariantsByProduct(prev => ({
      ...prev,
      [productId]: prev[productId].map(v => ({ ...v, available }))
    }))
    try {
      await Promise.all(variants.map(v => api.updateVariant(v.id, available)))
    } catch (err) {
      setError('Failed to update variants')
      loadData()
    }
  }

  // ── Stock badge ──
  const getStockBadge = (productId: number) => {
    const variants = variantsByProduct[productId] || []
    if (variants.length === 0) return null
    const available = variants.filter(v => v.available).length
    const total = variants.length
    if (available === 0) return { label: 'Sold out', color: '#791F1F', bg: '#FCEBEB' }
    if (available === total) return { label: 'All in stock', color: '#085041', bg: '#E1F5EE' }
    return { label: `${available}/${total} in stock`, color: '#633806', bg: '#FAEEDA' }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="products-page">
      <div className="page-header">
        <h2>Products</h2>
        <button onClick={() => setShowAddProduct(true)} className="btn-add">
          + Add Product
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* ── Add Product Modal ── */}
      {showAddProduct && (
        <div className="modal-overlay" onClick={() => setShowAddProduct(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Product</h3>

            <div className="form-group">
              <label>Product name *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Hoodie"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Price (Rs.) *</label>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="e.g. 2200"
              />
            </div>

            <div className="form-group">
              <label>
                Keywords / alternate names
                <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 6 }}>
                  (AI uses these to match customer messages)
                </span>
              </label>
              <input
                type="text"
                value={newKeywords}
                onChange={e => setNewKeywords(e.target.value)}
                placeholder="e.g. hoodie, jacket, kapada, tyo kapada"
              />
            </div>

            <div className="form-group">
              <label>
                Quality / fabric notes
                <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 6 }}>
                  (AI uses this to answer quality questions)
                </span>
              </label>
              <textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="e.g. 100% cotton, machine wash cold, does not fade"
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="modal-buttons">
              <button onClick={() => setShowAddProduct(false)} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={handleAddProduct}
                className="btn-primary"
                disabled={addingProduct || !newName.trim() || !newPrice}
              >
                {addingProduct ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Products List ── */}
      {products.length === 0 ? (
        <div className="empty-state">
          <p>No products yet</p>
          <p className="hint">Add your first product to start generating AI replies</p>
        </div>
      ) : (
        <div className="products-list">
          {products.map(product => {
            const badge = getStockBadge(product.id)
            const variants = variantsByProduct[product.id] || []
            const isExpanded = expandedProduct === product.id

            return (
              <div key={product.id} className="product-card">

                {/* ── Product Header ── */}
                <div
                  className="product-header"
                  onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <span className="product-price">Rs. {product.price}</span>
                    {product.keywords && (
                      <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
                        {product.keywords}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {badge && (
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        padding: '2px 8px', borderRadius: 20,
                        background: badge.bg, color: badge.color
                      }}>
                        {badge.label}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {variants.length} variants
                    </span>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* ── Expanded Section ── */}
                {isExpanded && (
                  <div className="variants-section">

                    {/* Bulk actions */}
                    {variants.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button
                          onClick={() => handleMarkAll(product.id, true)}
                          style={{
                            fontSize: 12, padding: '5px 12px',
                            borderRadius: 8, border: '0.5px solid #ccc',
                            background: 'transparent', cursor: 'pointer'
                          }}
                        >
                          Mark all in stock
                        </button>
                        <button
                          onClick={() => handleMarkAll(product.id, false)}
                          style={{
                            fontSize: 12, padding: '5px 12px',
                            borderRadius: 8, border: '0.5px solid #ccc',
                            background: 'transparent', cursor: 'pointer'
                          }}
                        >
                          Mark all sold out
                        </button>
                      </div>
                    )}

                    {/* ── Variant rows with instant toggle ── */}
                    {variants.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
                        No variants yet — add variants below
                      </p>
                    ) : (
                      <div className="variants-list" style={{ marginBottom: 12 }}>
                        {variants.map(variant => (
                          <div
                            key={variant.id}
                            className="variant-item"
                            style={{
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '0.5px solid #e5e5e5',
                              marginBottom: 6,
                              background: variant.available ? '#fff' : '#fafafa',
                              opacity: variant.available ? 1 : 0.6
                            }}
                          >
                            <span style={{
                              fontSize: 13,
                              fontWeight: 500,
                              textDecoration: variant.available ? 'none' : 'line-through',
                              color: variant.available ? '#1a1a1a' : '#999'
                            }}>
                              {variant.color} — {variant.size}
                            </span>
                            <label style={{
                              display: 'flex', alignItems: 'center',
                              gap: 8, cursor: 'pointer'
                            }}>
                              <span style={{
                                fontSize: 11,
                                color: variant.available ? '#085041' : '#791F1F'
                              }}>
                                {variant.available ? 'In stock' : 'Sold out'}
                              </span>
                              {/* Toggle switch */}
                              <div
                                onClick={() => handleToggleVariant(variant)}
                                style={{
                                  width: 36, height: 20,
                                  borderRadius: 10,
                                  background: variant.available ? '#1D9E75' : '#ccc',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                              >
                                <div style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: variant.available ? 18 : 2,
                                  width: 16, height: 16,
                                  borderRadius: '50%',
                                  background: '#fff',
                                  transition: 'left 0.2s'
                                }} />
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Add variants via grid ── */}
                    {showVariantGrid === product.id ? (
                      <div style={{
                        background: '#f9f9f9', borderRadius: 10,
                        padding: 16, border: '0.5px solid #e5e5e5',
                        marginBottom: 12
                      }}>
                        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 12 }}>
                          Add variants
                        </div>

                        {!gridGenerated ? (
                          <>
                            <div className="form-group">
                              <label style={{ fontSize: 12 }}>
                                Colors (comma separated)
                              </label>
                              <input
                                type="text"
                                value={gridColors}
                                onChange={e => setGridColors(e.target.value)}
                                placeholder="Red, Blue, Black, White"
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: 12 }}>
                                Sizes (comma separated)
                              </label>
                              <input
                                type="text"
                                value={gridSizes}
                                onChange={e => setGridSizes(e.target.value)}
                                placeholder="S, M, L, XL"
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={handleGenerateGrid}
                                className="btn-primary"
                                disabled={!gridColors.trim() || !gridSizes.trim()}
                                style={{ fontSize: 13 }}
                              >
                                Generate grid
                              </button>
                              <button
                                onClick={() => {
                                  setShowVariantGrid(null)
                                  handleResetGrid()
                                }}
                                className="btn-cancel"
                                style={{ fontSize: 13 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                              {gridVariants.length} combinations generated —
                              toggle off what's sold out
                            </div>

                            {/* Bulk select for grid */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                              <button
                                onClick={() => handleMarkAllGrid(true)}
                                style={{
                                  fontSize: 11, padding: '3px 10px',
                                  borderRadius: 6, border: '0.5px solid #ccc',
                                  background: 'transparent', cursor: 'pointer'
                                }}
                              >
                                Check all
                              </button>
                              <button
                                onClick={() => handleMarkAllGrid(false)}
                                style={{
                                  fontSize: 11, padding: '3px 10px',
                                  borderRadius: 6, border: '0.5px solid #ccc',
                                  background: 'transparent', cursor: 'pointer'
                                }}
                              >
                                Uncheck all
                              </button>
                            </div>

                            {/* Grid */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                              gap: 6, marginBottom: 14
                            }}>
                              {gridVariants.map((v, i) => (
                                <div
                                  key={i}
                                  onClick={() => toggleGridVariant(i)}
                                  style={{
                                    display: 'flex', alignItems: 'center',
                                    gap: 8, padding: '7px 10px',
                                    borderRadius: 8, cursor: 'pointer',
                                    border: `0.5px solid ${v.available ? '#1D9E75' : '#e5e5e5'}`,
                                    background: v.available ? '#E1F5EE' : '#fafafa',
                                    opacity: v.available ? 1 : 0.5,
                                    userSelect: 'none'
                                  }}
                                >
                                  <div style={{
                                    width: 14, height: 14,
                                    borderRadius: 3,
                                    border: `1.5px solid ${v.available ? '#1D9E75' : '#ccc'}`,
                                    background: v.available ? '#1D9E75' : 'transparent',
                                    flexShrink: 0,
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    {v.available && (
                                      <span style={{
                                        color: '#fff', fontSize: 9, fontWeight: 700
                                      }}>✓</span>
                                    )}
                                  </div>
                                  <span style={{
                                    fontSize: 12,
                                    color: v.available ? '#085041' : '#999',
                                    fontWeight: v.available ? 500 : 400
                                  }}>
                                    {v.color} / {v.size}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleSaveVariants(product.id)}
                                className="btn-primary"
                                disabled={savingVariants}
                                style={{ fontSize: 13 }}
                              >
                                {savingVariants
                                  ? 'Saving...'
                                  : `Save ${gridVariants.filter(v => v.available).length} variants`
                                }
                              </button>
                              <button
                                onClick={handleResetGrid}
                                className="btn-cancel"
                                style={{ fontSize: 13 }}
                              >
                                Back
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowVariantGrid(product.id)
                          handleResetGrid()
                        }}
                        className="btn-add-small"
                        style={{ marginBottom: 12, fontSize: 13 }}
                      >
                        + Add variants
                      </button>
                    )}

                    {/* Delete product */}
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="btn-delete-product"
                    >
                      🗑 Delete Product
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}