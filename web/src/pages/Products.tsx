import { useState, useEffect, useRef } from 'react'
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

type AddProductMode = 'quick' | 'manual'

interface QuickAddDraft {
  name: string
  price: string
  colors: string
  sizes: string
}

const EMPTY_QUICK_DRAFT: QuickAddDraft = {
  name: '',
  price: '',
  colors: '',
  sizes: '',
}

const SIZE_TOKEN_PATTERN =
  /^(xxs|xs|s|m|l|x|xl|xxl|xxxl|2xl|3xl|4xl|5xl|fs|freesize|small|medium|large|extralarge|\d{2,3})$/i

const SIZE_TOKEN_ALIASES: Record<string, string> = {
  'free size': 'freesize',
  xll: 'xl',
  xl1: 'xl',
  xli: 'xl',
  xlll: 'xxl',
  xxl1: 'xxl',
  xxli: 'xxl',
  xxll: 'xxl',
  xxxl1: 'xxxl',
  xxxli: 'xxxl',
  xxxll: 'xxxl',
}

const SIZE_DISPLAY_MAP: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  extralarge: 'XL',
  freesize: 'FREE SIZE',
  fs: 'FREE SIZE',
}

const COLOR_KEYWORDS = [
  'black',
  'white',
  'green',
  'blue',
  'red',
  'pink',
  'yellow',
  'brown',
  'grey',
  'gray',
  'purple',
  'orange',
  'maroon',
  'cream',
  'beige',
  'navy',
  'olive',
  'silver',
  'gold',
]

function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const item of items) {
    const key = item.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

function normalizeSizeToken(token: string): string {
  const trimmed = token.trim().toLowerCase()
  const compact = trimmed.replace(/[^a-z0-9\s]+/g, '').replace(/\s+/g, '')
  const compactAlias = SIZE_TOKEN_ALIASES[compact]
  if (compactAlias) {
    return compactAlias
  }

  const typoNormalized = compact
    .replace(/^xl1$/, 'xl')
    .replace(/^xli$/, 'xl')
    .replace(/^xxl1$/, 'xxl')
    .replace(/^xxli$/, 'xxl')
    .replace(/^xxxl1$/, 'xxxl')
    .replace(/^xxxli$/, 'xxxl')

  const typoAlias = SIZE_TOKEN_ALIASES[typoNormalized]
  if (typoAlias) {
    return typoAlias
  }

  const trimmedAlias = SIZE_TOKEN_ALIASES[trimmed]
  if (trimmedAlias) {
    return trimmedAlias
  }

  return typoNormalized
}

function toDisplayToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''

  const normalizedSize = normalizeSizeToken(trimmed)
  if (SIZE_TOKEN_PATTERN.test(normalizedSize)) {
    if (SIZE_DISPLAY_MAP[normalizedSize]) {
      return SIZE_DISPLAY_MAP[normalizedSize]
    }
    return normalizedSize.toUpperCase()
  }

  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function parseCommaList(value: string): string[] {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(toDisplayToken)

  return dedupeCaseInsensitive(items)
}

function isLikelySize(token: string): boolean {
  const normalized = normalizeSizeToken(token)
  return SIZE_TOKEN_PATTERN.test(normalized)
}

function isLikelyColor(token: string): boolean {
  const normalized = token.toLowerCase()
  return COLOR_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function parseQuickAddInput(rawInput: string): QuickAddDraft | null {
  const normalized = rawInput.replace(/\n/g, ',').replace(/\|/g, ',')
  const tokens = normalized
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return null
  }

  let parsedPrice = ''
  const nonPriceTokens: string[] = []

  for (const token of tokens) {
    const priceMatch = token.match(/(?:rs\.?|npr)\s*([0-9]+(?:\.[0-9]{1,2})?)|^([0-9]+(?:\.[0-9]{1,2})?)$/i)

    if (!parsedPrice && priceMatch) {
      parsedPrice = priceMatch[1] || priceMatch[2] || ''
      const leftover = token.replace(priceMatch[0], '').replace(/^[-:\s]+|[-:\s]+$/g, '')
      if (leftover) {
        nonPriceTokens.push(leftover)
      }
      continue
    }

    nonPriceTokens.push(token)
  }

  if (nonPriceTokens.length === 0) {
    return null
  }

  const name = nonPriceTokens[0].trim()
  const colors: string[] = []
  const sizes: string[] = []

  for (const token of nonPriceTokens.slice(1)) {
    if (isLikelySize(token)) {
      sizes.push(toDisplayToken(token))
      continue
    }

    if (isLikelyColor(token)) {
      colors.push(toDisplayToken(token))
      continue
    }
  }

  return {
    name,
    price: parsedPrice,
    colors: dedupeCaseInsensitive(colors).join(', '),
    sizes: dedupeCaseInsensitive(sizes).join(', '),
  }
}

function buildVariantCombinations(colors: string[], sizes: string[]): VariantRow[] {
  if (colors.length === 0 || sizes.length === 0) {
    return []
  }

  const combinations: VariantRow[] = []
  for (const color of colors) {
    for (const size of sizes) {
      combinations.push({ color, size, available: true })
    }
  }

  return combinations
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
  const [addProductMode, setAddProductMode] = useState<AddProductMode>('quick')
  const [quickAddRaw, setQuickAddRaw] = useState('')
  const [quickDraft, setQuickDraft] = useState<QuickAddDraft>(EMPTY_QUICK_DRAFT)
  const [quickParsed, setQuickParsed] = useState(false)
  const [quickParseError, setQuickParseError] = useState('')
  const quickPreviewRef = useRef<HTMLDivElement | null>(null)

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

  const resetManualAddForm = () => {
    setNewName('')
    setNewPrice('')
    setNewKeywords('')
    setNewNotes('')
  }

  const resetQuickAddForm = () => {
    setQuickAddRaw('')
    setQuickDraft({ ...EMPTY_QUICK_DRAFT })
    setQuickParsed(false)
    setQuickParseError('')
  }

  const openAddProductModal = () => {
    setAddProductMode('quick')
    setShowAddProduct(true)
    resetQuickAddForm()
  }

  const closeAddProductModal = () => {
    setShowAddProduct(false)
    setAddProductMode('quick')
    resetManualAddForm()
    resetQuickAddForm()
  }

  const addCreatedProductToState = (created: Product, createdVariants: Variant[] = []) => {
    const product: Product = { ...created, variants: createdVariants }
    setProducts((prev) => {
      const nextProducts = [product, ...prev]
      onDataChange?.(nextProducts)
      return nextProducts
    })
    setVariantsByProduct((prev) => ({
      ...prev,
      [product.id]: createdVariants,
    }))
  }

  const updateQuickDraftField = (field: keyof QuickAddDraft, value: string) => {
    setQuickDraft((prev) => ({ ...prev, [field]: value }))
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

  const handleParseQuickAdd = () => {
    setQuickParseError('')

    const parsed = parseQuickAddInput(quickAddRaw)
    if (!parsed || !parsed.name.trim()) {
      setQuickParsed(false)
      setQuickParseError('Could not parse product details. Add commas and include at least a product name.')
      return
    }

    setQuickDraft(parsed)
    setQuickParsed(true)

    window.setTimeout(() => {
      quickPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)

    if (!parsed.price) {
      setQuickParseError('Price was not detected. Please enter price in the preview before saving.')
    }
  }

  const handleSaveQuickAdd = async () => {
    const name = quickDraft.name.trim()
    const priceValue = Number.parseFloat(quickDraft.price)
    const colors = parseCommaList(quickDraft.colors)
    const sizes = parseCommaList(quickDraft.sizes)
    const variantsToCreate = buildVariantCombinations(colors, sizes)

    if (!name) {
      setQuickParseError('Product name is required.')
      return
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setQuickParseError('Valid price is required before saving.')
      return
    }

    if (variantsToCreate.length > 200) {
      setQuickParseError('Too many variants generated. Reduce colors/sizes (max 200 variants).')
      return
    }

    setAddingProduct(true)
    setQuickParseError('')

    try {
      const created = await productApi.createProduct(
        name,
        priceValue
      )

      let createdVariants: Variant[] = []
      if (variantsToCreate.length > 0) {
        try {
          createdVariants = await productApi.createVariantsBulk(created.id, variantsToCreate)
        } catch (variantErr) {
          addCreatedProductToState(created, [])
          closeAddProductModal()
          const variantMessage =
            variantErr instanceof Error ? variantErr.message : 'Failed to create variants'
          notify({
            type: 'warning',
            title: 'Product added without variants',
            message: `${created.name} was saved. ${variantMessage}. Add variants from the product card.`,
          })
          return
        }
      }

      addCreatedProductToState(created, createdVariants)
      closeAddProductModal()

      notify({
        type: 'success',
        title: 'Quick add complete',
        message:
          createdVariants.length > 0
            ? `${created.name} with ${createdVariants.length} variants saved.`
            : `${created.name} saved. Add variants anytime.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add product'
      setError(message)
      notify({ type: 'error', title: 'Could not save quick add', message })
    } finally {
      setAddingProduct(false)
    }
  }

  // ── Add product ──
  const handleAddProduct = async () => {
    const name = newName.trim()
    const priceValue = Number.parseFloat(newPrice)

    if (!name || !Number.isFinite(priceValue) || priceValue <= 0) return

    setAddingProduct(true)
    try {
      const created = await productApi.createProduct(
        name,
        priceValue,
        newKeywords.trim() || undefined,
        newNotes.trim() || undefined
      )
      addCreatedProductToState(created, [])
      closeAddProductModal()
      notify({ type: 'success', title: 'Product added', message: created.name })
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

  const quickPreviewVariantsCount = buildVariantCombinations(
    parseCommaList(quickDraft.colors),
    parseCommaList(quickDraft.sizes)
  ).length
  const quickPriceValue = Number.parseFloat(quickDraft.price)
  const quickSaveDisabled =
    addingProduct || !quickDraft.name.trim() || !Number.isFinite(quickPriceValue) || quickPriceValue <= 0

  return (
    <div className="products-page">
      <div className="page-header">
        <h2>Products</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <AppButton onClick={() => loadData(false)} variant="secondary" size="sm">
            Refresh
          </AppButton>
          <AppButton onClick={openAddProductModal} className="btn-add" variant="primary">
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
        <div className="modal-overlay" onClick={closeAddProductModal}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={addProductMode === 'quick' ? { width: 'min(720px, 95vw)' } : undefined}
          >
            <h3>Add Product</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <AppButton
                onClick={() => {
                  setAddProductMode('quick')
                  setQuickParseError('')
                }}
                size="sm"
                variant={addProductMode === 'quick' ? 'primary' : 'secondary'}
              >
                Quick add
              </AppButton>
              <AppButton
                onClick={() => {
                  setAddProductMode('manual')
                  setQuickParseError('')
                }}
                size="sm"
                variant={addProductMode === 'manual' ? 'primary' : 'secondary'}
              >
                Manual
              </AppButton>
            </div>

            {addProductMode === 'quick' ? (
              <>
                <div className="form-group">
                  <label>Quick input *</label>
                  <textarea
                    value={quickAddRaw}
                    onChange={(event) => setQuickAddRaw(event.target.value)}
                    placeholder="hoodie, black, white, green, m, l, xl, rs 1200"
                    rows={3}
                    style={{ width: '100%', resize: 'vertical' }}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>
                    Paste one line and parse. You can edit everything before saving.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <AppButton
                    onClick={handleParseQuickAdd}
                    size="sm"
                    className="btn-primary"
                    disabled={!quickAddRaw.trim() || addingProduct}
                  >
                    Parse input
                  </AppButton>
                  <AppButton
                    onClick={resetQuickAddForm}
                    size="sm"
                    variant="secondary"
                  >
                    Reset
                  </AppButton>
                </div>

                {quickParseError ? (
                  <AppAlert type="warning" title="Quick add check">
                    {quickParseError}
                  </AppAlert>
                ) : null}

                {quickParsed ? (
                  <>
                    <div
                      ref={quickPreviewRef}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 10,
                      }}
                    >
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Product name *</label>
                        <input
                          type="text"
                          value={quickDraft.name}
                          onChange={(event) => updateQuickDraftField('name', event.target.value)}
                          placeholder="e.g. Hoodie"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Price (Rs.) *</label>
                        <input
                          type="number"
                          value={quickDraft.price}
                          onChange={(event) => updateQuickDraftField('price', event.target.value)}
                          placeholder="e.g. 1200"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Colors (comma separated)</label>
                        <input
                          type="text"
                          value={quickDraft.colors}
                          onChange={(event) => updateQuickDraftField('colors', event.target.value)}
                          placeholder="e.g. Black, White, Green"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Sizes (comma separated)</label>
                        <input
                          type="text"
                          value={quickDraft.sizes}
                          onChange={(event) => updateQuickDraftField('sizes', event.target.value)}
                          placeholder="e.g. M, L, XL"
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                      Preview: {quickPreviewVariantsCount} variants from colors x sizes. Keywords and notes can be added later in Manual mode.
                    </div>
                  </>
                ) : null}

                <div className="modal-buttons">
                  <AppButton onClick={closeAddProductModal} className="btn-cancel" variant="secondary">
                    Cancel
                  </AppButton>
                  <AppButton
                    onClick={handleSaveQuickAdd}
                    className="btn-primary"
                    disabled={quickSaveDisabled}
                    loading={addingProduct}
                    loadingText="Saving..."
                  >
                    Save Quick Add
                  </AppButton>
                </div>
              </>
            ) : (
              <>
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
                  <AppButton onClick={closeAddProductModal} className="btn-cancel" variant="secondary">
                    Cancel
                  </AppButton>
                  <AppButton
                    onClick={handleAddProduct}
                    className="btn-primary"
                    disabled={
                      addingProduct ||
                      !newName.trim() ||
                      !Number.isFinite(Number.parseFloat(newPrice)) ||
                      Number.parseFloat(newPrice) <= 0
                    }
                    loading={addingProduct}
                    loadingText="Adding..."
                  >
                    Add Product
                  </AppButton>
                </div>
              </>
            )}
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