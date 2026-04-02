import { useState, useEffect } from 'react'
import { api, DeliveryZone } from '../services/api'
import { useUIFeedback } from '../context/UIFeedbackContext'
import AppAlert from '../components/ui/AppAlert'
import AppButton from '../components/ui/AppButton'

export default function DeliveryZones() {
  const { notify } = useUIFeedback()
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add zone form
  const [showAddZone, setShowAddZone] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [newZonePrice, setNewZonePrice] = useState('')
  const [newZoneCod, setNewZoneCod] = useState(true)
  const [addingZone, setAddingZone] = useState(false)

  // Edit zone
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCod, setEditCod] = useState(true)

  useEffect(() => {
    loadZones()
  }, [])

  const loadZones = async () => {
    setLoading(true)
    setError('')
    try {
      const zonesData = await api.getDeliveryZones()
      setZones(zonesData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load zones'
      setError(message)
      notify({ type: 'error', title: 'Could not load delivery zones', message })
    } finally {
      setLoading(false)
    }
  }

  const handleAddZone = async () => {
    if (!newZoneName.trim() || !newZonePrice) return

    setAddingZone(true)
    try {
      const zone = await api.createDeliveryZone(
        newZoneName.trim(),
        parseFloat(newZonePrice),
        newZoneCod
      )
      setZones([...zones, zone])
      setNewZoneName('')
      setNewZonePrice('')
      setNewZoneCod(true)
      setShowAddZone(false)
      notify({ type: 'success', title: 'Delivery zone added', message: zone.name })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add zone'
      setError(message)
      notify({ type: 'error', title: 'Could not add zone', message })
    } finally {
      setAddingZone(false)
    }
  }

  const handleEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone)
    setEditName(zone.name)
    setEditPrice(zone.price.toString())
    setEditCod(zone.cod_available)
  }

  const handleUpdateZone = async () => {
    if (!editingZone || !editName.trim() || !editPrice) return

    try {
      const updated = await api.updateDeliveryZone(
        editingZone.id,
        editName.trim(),
        parseFloat(editPrice),
        editCod
      )
      setZones(zones.map(z => z.id === updated.id ? updated : z))
      setEditingZone(null)
      notify({ type: 'success', title: 'Delivery zone updated', message: updated.name })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update zone'
      setError(message)
      notify({ type: 'error', title: 'Could not update zone', message })
    }
  }

  const handleDeleteZone = async (id: number) => {
    if (!confirm('Delete this delivery zone?')) return

    try {
      await api.deleteDeliveryZone(id)
      setZones(zones.filter(z => z.id !== id))
      notify({ type: 'success', title: 'Delivery zone deleted' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete zone'
      setError(message)
      notify({ type: 'error', title: 'Could not delete zone', message })
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="delivery-page">
      <div className="page-header">
        <h2>Delivery Zones</h2>
        <AppButton onClick={() => setShowAddZone(true)} className="btn-add" variant="primary">
          + Add Zone
        </AppButton>
      </div>

      {error ? (
        <AppAlert type="error" title="Delivery operation failed">
          {error}
        </AppAlert>
      ) : null}

      {/* Add Zone Modal */}
      {showAddZone && (
        <div className="modal-overlay" onClick={() => setShowAddZone(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Delivery Zone</h3>
            <div className="form-group">
              <label>Zone Name</label>
              <input
                type="text"
                value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                placeholder="e.g., Kathmandu, Pokhara"
              />
            </div>
            <div className="form-group">
              <label>Delivery Price (Rs.)</label>
              <input
                type="number"
                value={newZonePrice}
                onChange={e => setNewZonePrice(e.target.value)}
                placeholder="e.g., 100"
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newZoneCod}
                  onChange={e => setNewZoneCod(e.target.checked)}
                />
                COD Available
              </label>
            </div>
            <div className="modal-buttons">
              <AppButton onClick={() => setShowAddZone(false)} className="btn-cancel" variant="secondary">
                Cancel
              </AppButton>
              <AppButton onClick={handleAddZone} className="btn-primary" loading={addingZone} loadingText="Adding...">
                Add Zone
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Zone Modal */}
      {editingZone && (
        <div className="modal-overlay" onClick={() => setEditingZone(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Delivery Zone</h3>
            <div className="form-group">
              <label>Zone Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Delivery Price (Rs.)</label>
              <input
                type="number"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={editCod}
                  onChange={e => setEditCod(e.target.checked)}
                />
                COD Available
              </label>
            </div>
            <div className="modal-buttons">
              <AppButton onClick={() => setEditingZone(null)} className="btn-cancel" variant="secondary">
                Cancel
              </AppButton>
              <AppButton onClick={handleUpdateZone} className="btn-primary">
                Save Changes
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Zones List */}
      {zones.length === 0 ? (
        <div className="empty-state">
          <p>No delivery zones yet</p>
          <p className="hint">Add zones to enable delivery-related AI replies</p>
        </div>
      ) : (
        <div className="zones-list">
          {zones.map(zone => (
            <div key={zone.id} className="zone-card">
              <div className="zone-info">
                <h3>{zone.name}</h3>
                <div className="zone-details">
                  <span className="zone-price">Rs. {zone.price}</span>
                  <span className={`zone-cod ${zone.cod_available ? 'available' : 'unavailable'}`}>
                    COD: {zone.cod_available ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <div className="zone-actions">
                <button onClick={() => handleEditZone(zone)} className="btn-edit">
                  ✏️
                </button>
                <button onClick={() => handleDeleteZone(zone.id)} className="btn-delete">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
