import { useState, useEffect } from 'react'
import { api, Product, Variant } from '../services/api'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, Variant[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New product form
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  // New variant form
  const [showAddVariant, setShowAddVariant] = useState<number | null>(null)
  const [newVariantColor, setNewVariantColor] = useState('')
  const [newVariantSize, setNewVariantSize] = useState('')
  const [addingVariant, setAddingVariant] = useState(false)

  // Expanded product
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)

  // Availability confirmation modal
  const [confirmModal, setConfirmModal] = useState<{ variant: Variant; action: 'available' | 'soldout' } | null>(null)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const productsData = await api.getProducts()
      setProducts(productsData)

      // Load variants for each product
      const variantsMap: Record<number, Variant[]> = {}
      for (const product of productsData) {
        const variants = await api.getVariants(product.id)
        variantsMap[product.id] = variants
      }
      setVariantsByProduct(variantsMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !newProductPrice) return

    setAddingProduct(true)
    try {
      const product = await api.createProduct(newProductName.trim(), parseFloat(newProductPrice))
      setProducts([product, ...products])
      setVariantsByProduct({ ...variantsByProduct, [product.id]: [] })
      setNewProductName('')
      setNewProductPrice('')
      setShowAddProduct(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setAddingProduct(false)
    }
  }

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product and all its variants?')) return

    try {
      await api.deleteProduct(id)
      setProducts(products.filter(p => p.id !== id))
      const newVariants = { ...variantsByProduct }
      delete newVariants[id]
      setVariantsByProduct(newVariants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  const handleAddVariant = async (productId: number) => {
    if (!newVariantColor.trim() || !newVariantSize.trim()) return

    setAddingVariant(true)
    try {
      const variant = await api.createVariant(productId, newVariantColor.trim(), newVariantSize.trim())
      setVariantsByProduct({
        ...variantsByProduct,
        [productId]: [variant, ...(variantsByProduct[productId] || [])]
      })
      setNewVariantColor('')
      setNewVariantSize('')
      setShowAddVariant(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add variant')
    } finally {
      setAddingVariant(false)
    }
  }

  const handleToggleAvailability = async (variant: Variant) => {
    setUpdatingAvailability(true)
    try {
      const updated = await api.updateVariant(variant.id, !variant.available)
      setVariantsByProduct({
        ...variantsByProduct,
        [variant.product_id]: variantsByProduct[variant.product_id].map(v =>
          v.id === variant.id ? { ...v, available: updated.available } : v
        )
      })
      setConfirmModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variant')
    } finally {
      setUpdatingAvailability(false)
    }
  }

  const openConfirmModal = (variant: Variant) => {
    const action = variant.available ? 'soldout' : 'available'
    setConfirmModal({ variant, action })
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <h2>Products</h2>
        <button onClick={() => setShowAddProduct(true)} className="btn-add">
          + Add Product
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="modal-overlay" onClick={() => setShowAddProduct(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Product</h3>
            <div className="form-group">
              <label>Product Name</label>
              <input
                type="text"
                value={newProductName}
                onChange={e => setNewProductName(e.target.value)}
                placeholder="e.g., Hoodie, Kurtha"
              />
            </div>
            <div className="form-group">
              <label>Price (Rs.)</label>
              <input
                type="number"
                value={newProductPrice}
                onChange={e => setNewProductPrice(e.target.value)}
                placeholder="e.g., 2200"
              />
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowAddProduct(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleAddProduct} className="btn-primary" disabled={addingProduct}>
                {addingProduct ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <div className="empty-state">
          <p>No products yet</p>
          <p className="hint">Add your products to start generating AI replies</p>
        </div>
      ) : (
        <div className="products-list">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-header">
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <span className="product-price">Rs. {product.price}</span>
                </div>
                <div className="product-meta">
                  <span className="variant-count">
                    {variantsByProduct[product.id]?.length || 0} variants
                  </span>
                </div>
                <button 
                  className="btn-expand"
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  aria-label={expandedProduct === product.id ? 'Collapse variants' : 'Expand variants'}
                >
                  {expandedProduct === product.id ? '▲' : '▼'}
                </button>
              </div>

              {/* Expanded Variants */}
              {expandedProduct === product.id && (
                <div className="variants-section">
                  <div className="variants-header">
                    <span>Variants</span>
                    <button 
                      onClick={() => setShowAddVariant(product.id)} 
                      className="btn-add-small"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Add Variant Form */}
                  {showAddVariant === product.id && (
                    <div className="add-variant-form">
                      <input
                        type="text"
                        value={newVariantColor}
                        onChange={e => setNewVariantColor(e.target.value)}
                        placeholder="Color (e.g., Blue)"
                      />
                      <input
                        type="text"
                        value={newVariantSize}
                        onChange={e => setNewVariantSize(e.target.value)}
                        placeholder="Size (e.g., M)"
                      />
                      <button 
                        onClick={() => handleAddVariant(product.id)}
                        disabled={addingVariant}
                        className="btn-primary-small"
                      >
                        {addingVariant ? '...' : 'Add'}
                      </button>
                      <button 
                        onClick={() => setShowAddVariant(null)}
                        className="btn-cancel-small"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Variants List */}
                  {variantsByProduct[product.id]?.length === 0 ? (
                    <p className="no-variants">No variants added</p>
                  ) : (
                    <div className="variants-list">
                      {variantsByProduct[product.id]?.map(variant => (
                        <div key={variant.id} className="variant-item">
                          <div className="variant-details">
                            <div className="variant-field">
                              <span className="variant-label">Color</span>
                              <span className="variant-value">{variant.color}</span>
                            </div>
                            <div className="variant-field">
                              <span className="variant-label">Size</span>
                              <span className="variant-value">{variant.size}</span>
                            </div>
                            <div className="variant-field">
                              <span className="variant-label">Status</span>
                              <span className={`status-badge ${variant.available ? 'available' : 'unavailable'}`}>
                                {variant.available ? 'Available' : 'Sold Out'}
                              </span>
                            </div>
                          </div>
                          <div className="variant-actions">
                            <button
                              onClick={() => openConfirmModal(variant)}
                              className={`btn-toggle-availability ${variant.available ? 'mark-soldout' : 'mark-available'}`}
                            >
                              {variant.available ? 'Mark as Sold Out' : 'Mark as Available'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delete Product */}
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="btn-delete-product"
                  >
                    🗑 Delete Product
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Availability Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Availability Change</h3>
            <p className="confirm-message">
              Are you sure you want to mark <strong>{confirmModal.variant.color} - {confirmModal.variant.size}</strong> as{' '}
              <strong>{confirmModal.action === 'soldout' ? 'Sold Out' : 'Available'}</strong>?
            </p>
            <div className="modal-buttons">
              <button onClick={() => setConfirmModal(null)} className="btn-cancel" disabled={updatingAvailability}>
                Cancel
              </button>
              <button 
                onClick={() => handleToggleAvailability(confirmModal.variant)} 
                className={`btn-confirm ${confirmModal.action === 'soldout' ? 'btn-confirm-soldout' : 'btn-confirm-available'}`}
                disabled={updatingAvailability}
              >
                {updatingAvailability ? 'Updating...' : confirmModal.action === 'soldout' ? 'Mark as Sold Out' : 'Mark as Available'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
