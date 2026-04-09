import { useState, useEffect } from 'react'
import { productApi } from '../services/api/productApi'
import type { Product, Variant } from '../services/api/types'
import { useUIFeedback } from '../context/UIFeedbackContext'
import AppAlert from '../components/ui/AppAlert'
import AppButton from '../components/ui/AppButton'

interface VariantRow {
  color: string
  size: string
  available: boolean
}

interface ProductsProps {
  initialData?: Product[] | null
  onDataChange?: (products: Product[]) => void
}

export default function Products({ initialData = null, onDataChange }: ProductsProps) {
  const { notify } = useUIFeedback()
  const [products, setProducts] = useState<Product[]>([])
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, Variant[]>>({})
  const [loading, setLoading] = useState(initialData === null)
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

  const syncProductVariants = (productId: number, nextVariants: Variant[]) => {
    setProducts(prev => {
      const next = prev.map(product =>
        product.id === productId
          ? { ...product, variants: nextVariants }
          : product
      )
      onDataChange?.(next)
      return next
    })
  }

  const hydrateProductsData = async (productsData: Product[]) => {
    setProducts(productsData)
    onDataChange?.(productsData)

    const variantsMap: Record<number, Variant[]> = {}
    const missingVariantPayload = productsData.filter(product => !Array.isArray(product.variants))

    productsData.forEach(product => {
      if (Array.isArray(product.variants)) {
        variantsMap[product.id] = product.variants
      }
    })

    if (missingVariantPayload.length > 0) {
      const variantResults = await Promise.all(
        missingVariantPayload.map(product =>
          productApi.getVariants(product.id).then(variants => ({
            productId: product.id,
            variants,
          }))
        )
      )

      variantResults.forEach(result => {
        variantsMap[result.productId] = result.variants
      })

      setProducts(prev => {
        const next = prev.map(product => ({
          ...product,
          variants: variantsMap[product.id] ?? [],
        }))
        onDataChange?.(next)
        return next
      })
    }

    setVariantsByProduct(variantsMap)
  }

  useEffect(() => {
    if (initialData === null) {
      return
    }

    const variantsMap: Record<number, Variant[]> = {}
    initialData.forEach(product => {
      variantsMap[product.id] = Array.isArray(product.variants) ? product.variants : []
    })
    setProducts(initialData)
    setVariantsByProduct(variantsMap)
    setLoading(false)
  }, [initialData])

  useEffect(() => {
    if (initialData !== null) {
      return
    }

    loadData()
  }, [])

  const loadData = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    }
    setError('')
    try {
      const productsData = await productApi.getProducts()
      await hydrateProductsData(productsData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
      notify({ type: 'error', title: 'Could not load products', message })
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
      const createdVariants = await productApi.createVariantsBulk(productId, gridVariants)
      const existingVariants = variantsByProduct[productId] || []
      const updated = [...createdVariants, ...existingVariants].sort((a, b) => b.id - a.id)

      setVariantsByProduct(prev => ({ ...prev, [productId]: updated }))
      syncProductVariants(productId, updated)
      setShowVariantGrid(null)
      setGridColors('')
      setGridSizes('')
      setGridVariants([])
      setGridGenerated(false)
      notify({
        type: 'success',
        title: 'Variants saved',
        message: `${createdVariants.length} variants added.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save variants'
      setError(message)
      notify({ type: 'error', title: 'Could not save variants', message })
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
      const created = await productApi.createProduct(
        newName.trim(),
        parseFloat(newPrice),
        newKeywords.trim() || undefined,
        newNotes.trim() || undefined
      )
      const product: Product = { ...created, variants: [] }
      const nextProducts = [product, ...products]
      setProducts(nextProducts)
      onDataChange?.(nextProducts)
      setVariantsByProduct({ ...variantsByProduct, [product.id]: [] })
      setNewName(''); setNewPrice(''); setNewKeywords(''); setNewNotes('')
      setShowAddProduct(false)
      notify({ type: 'success', title: 'Product added', message: product.name })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add product'
      setError(message)
      notify({ type: 'error', title: 'Could not add product', message })
    } finally {
      setAddingProduct(false)
    }
  }

  // ── Delete product ──
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product and all its variants?')) return
    try {
      await productApi.deleteProduct(id)
      const nextProducts = products.filter(p => p.id !== id)
      setProducts(nextProducts)
      onDataChange?.(nextProducts)
      const updated = { ...variantsByProduct }
      delete updated[id]
      setVariantsByProduct(updated)
      notify({ type: 'success', title: 'Product deleted' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product'
      setError(message)
      notify({ type: 'error', title: 'Could not delete product', message })
    }
  }

  // ── Toggle variant availability — instant, no confirmation ──
  const handleToggleVariant = async (variant: Variant) => {
    // Optimistic update — change UI immediately
    setVariantsByProduct(prev => ({
      ...prev,
      [variant.product_id]: (prev[variant.product_id] || []).map(v =>
        v.id === variant.id ? { ...v, available: !v.available } : v
      )
    }))
    syncProductVariants(
      variant.product_id,
      (variantsByProduct[variant.product_id] || []).map(v =>
        v.id === variant.id ? { ...v, available: !v.available } : v
      )
    )
    try {
      await productApi.updateVariant(variant.id, !variant.available)
    } catch (err) {
      // Revert on failure
      setVariantsByProduct(prev => ({
        ...prev,
        [variant.product_id]: (prev[variant.product_id] || []).map(v =>
          v.id === variant.id ? { ...v, available: variant.available } : v
        )
      }))
      syncProductVariants(
        variant.product_id,
        (variantsByProduct[variant.product_id] || []).map(v =>
          v.id === variant.id ? { ...v, available: variant.available } : v
        )
      )
      setError('Failed to update variant')
      notify({ type: 'error', title: 'Could not update variant status' })
    }
  }

  // ── Mark all variants for a product ──
  const handleMarkAll = async (productId: number, available: boolean) => {
    const variants = variantsByProduct[productId] || []
    const updatedVariants = variants.map(v => ({ ...v, available }))
    // Optimistic update
    setVariantsByProduct(prev => ({
      ...prev,
      [productId]: updatedVariants
    }))
    syncProductVariants(productId, updatedVariants)
    try {
      await Promise.all(variants.map(v => productApi.updateVariant(v.id, available)))
      notify({
        type: 'success',
        title: available ? 'All variants marked in stock' : 'All variants marked sold out',
      })
    } catch (err) {
      setError('Failed to update variants')
      notify({ type: 'error', title: 'Could not update all variants' })
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
        <div style={{ display: 'flex', gap: 8 }}>
          <AppButton onClick={() => loadData(false)} variant="secondary" size="sm">
            Refresh
          </AppButton>
          <AppButton onClick={() => setShowAddProduct(true)} className="btn-add" variant="primary">
            + Add Product
          </AppButton>
        </div>
      </div>

      {error ? (
        <AppAlert type="error" title="Product operation failed">
          {error}
        </AppAlert>
      ) : null}

      <AppAlert type="info" title="Setup Tip">
        You do not need to add your full catalog. Start with your top 20 fast-selling items and add more later.
      </AppAlert>

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
              <AppButton onClick={() => setShowAddProduct(false)} className="btn-cancel" variant="secondary">
                Cancel
              </AppButton>
              <AppButton
                onClick={handleAddProduct}
                className="btn-primary"
                disabled={!newName.trim() || !newPrice}
                loading={addingProduct}
                loadingText="Adding..."
              >
                Add Product
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Products List ── */}
      {products.length === 0 ? (
        <div className="empty-state">
          <p>📦 No products yet</p>
          <p className="hint">Add your first product to start generating AI replies for customers</p>
        
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
                      <div className="variants-actions">
                        <AppButton
                          onClick={() => handleMarkAll(product.id, true)}
                          variant="secondary"
                          size="sm"
                        >
                          Mark all in stock
                        </AppButton>
                        <AppButton
                          onClick={() => handleMarkAll(product.id, false)}
                          variant="secondary"
                          size="sm"
                        >
                          Mark all sold out
                        </AppButton>
                      </div>
                    )}

                    {/* ── Variant rows with instant toggle ── */}
                    {variants.length === 0 ? (
                      <p className="variants-empty-hint">
                        No variants yet — add variants below
                      </p>
                    ) : (
                      <div className="variants-list">
                        {variants.map(variant => (
                          <div
                            key={variant.id}
                            className={`variant-item ${variant.available ? 'is-available' : 'is-unavailable'}`}
                          >
                            <span className={`variant-name ${variant.available ? '' : 'is-unavailable'}`}>
                              {variant.color} — {variant.size}
                            </span>
                            <div className="variant-control">
                              <span className={`variant-stock-text ${variant.available ? 'in' : 'out'}`}>
                                {variant.available ? 'In stock' : 'Sold out'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleVariant(variant)}
                                className={`variant-toggle ${variant.available ? 'is-on' : 'is-off'}`}
                                aria-label={`${variant.available ? 'Mark sold out' : 'Mark in stock'} ${variant.color} ${variant.size}`}
                              >
                                <span className="variant-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Add variants via grid ── */}
                    {showVariantGrid === product.id ? (
                      <div className="variant-builder-card">
                        <div className="variant-builder-title">
                          Add variants
                        </div>

                        {!gridGenerated ? (
                          <>
                            <div className="variant-builder-fields">
                              <div className="form-group variant-builder-field">
                                <label>Colors (comma separated)</label>
                                <input
                                  type="text"
                                  value={gridColors}
                                  onChange={e => setGridColors(e.target.value)}
                                  placeholder="Red, Blue, Black, White"
                                />
                              </div>
                              <div className="form-group variant-builder-field">
                                <label>Sizes (comma separated)</label>
                                <input
                                  type="text"
                                  value={gridSizes}
                                  onChange={e => setGridSizes(e.target.value)}
                                  placeholder="S, M, L, XL"
                                />
                              </div>
                            </div>

                            <div className="variant-builder-actions">
                              <AppButton
                                onClick={handleGenerateGrid}
                                className="btn-primary"
                                disabled={!gridColors.trim() || !gridSizes.trim()}
                                size="sm"
                              >
                                Generate grid
                              </AppButton>
                              <AppButton
                                onClick={() => {
                                  setShowVariantGrid(null)
                                  handleResetGrid()
                                }}
                                className="btn-cancel"
                                variant="secondary"
                                size="sm"
                              >
                                Cancel
                              </AppButton>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="variant-grid-note">
                              {gridVariants.length} combinations generated —
                              toggle off what's sold out
                            </div>

                            {/* Bulk select for grid */}
                            <div className="variant-grid-actions">
                              <AppButton
                                onClick={() => handleMarkAllGrid(true)}
                                variant="secondary"
                                size="sm"
                              >
                                Check all
                              </AppButton>
                              <AppButton
                                onClick={() => handleMarkAllGrid(false)}
                                variant="secondary"
                                size="sm"
                              >
                                Uncheck all
                              </AppButton>
                            </div>

                            {/* Grid */}
                            <div className="variant-grid-list">
                              {gridVariants.map((v, i) => (
                                <button
                                  type="button"
                                  key={i}
                                  onClick={() => toggleGridVariant(i)}
                                  className={`variant-grid-chip ${v.available ? 'is-available' : 'is-unavailable'}`}
                                >
                                  <span className={`variant-grid-check ${v.available ? 'is-checked' : ''}`}>
                                    {v.available ? '✓' : ''}
                                  </span>
                                  <span className="variant-grid-text">
                                    {v.color} / {v.size}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <div className="variant-builder-actions">
                              <AppButton
                                onClick={() => handleSaveVariants(product.id)}
                                className="btn-primary"
                                disabled={savingVariants}
                                size="sm"
                                loading={savingVariants}
                                loadingText="Saving..."
                              >
                                {`Save ${gridVariants.filter(v => v.available).length} variants`}
                              </AppButton>
                              <AppButton
                                onClick={handleResetGrid}
                                className="btn-cancel"
                                variant="secondary"
                                size="sm"
                              >
                                Back
                              </AppButton>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <AppButton
                        onClick={() => {
                          setShowVariantGrid(product.id)
                          handleResetGrid()
                        }}
                        className="btn-add-small"
                        size="sm"
                        style={{ marginBottom: 10 }}
                      >
                        + Add variants
                      </AppButton>
                    )}

                    {/* Delete product */}
                    <AppButton
                      onClick={() => handleDeleteProduct(product.id)}
                      className="btn-delete-product"
                      variant="danger"
                      fullWidth
                    >
                      🗑 Delete Product
                    </AppButton>
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