import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class DeliveryZonesScreen extends StatefulWidget {
  const DeliveryZonesScreen({super.key});

  @override
  State<DeliveryZonesScreen> createState() => _DeliveryZonesScreenState();
}

class _DeliveryZonesScreenState extends State<DeliveryZonesScreen> {
  static const String baseUrl = 'http://192.168.100.22:4000';
  static const String token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzY2ODEwMzkzLCJleHAiOjE3Njk0MDIzOTN9.j19l4aHF1juvjCUveOaDbFfAd70_1alB1oH-LeijsWo';

  List<dynamic> _zones = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadZones();
  }

  Future<void> _loadZones() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/delivery-zones'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        setState(() {
          _zones = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to load zones');
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load delivery zones';
        _isLoading = false;
      });
    }
  }

  Future<void> _createZone(String name, double price, bool codAvailable) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/delivery-zones'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'name': name,
        'price': price,
        'codAvailable': codAvailable,
      }),
    );

    if (response.statusCode != 201) {
      throw Exception('Failed to create zone');
    }
  }

  Future<void> _updateZone(
      int zoneId, String name, double price, bool codAvailable) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/delivery-zones/$zoneId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'name': name,
        'price': price,
        'codAvailable': codAvailable,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to update zone');
    }
  }

  Future<void> _deleteZone(int zoneId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/delivery-zones/$zoneId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete zone');
    }
  }

  void _showAddZoneDialog() {
    final nameController = TextEditingController();
    final priceController = TextEditingController();
    bool codAvailable = true;
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Delivery Zone'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Zone Name',
                  border: OutlineInputBorder(),
                  hintText: 'e.g., Inside Valley, Outside Valley',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Delivery Price',
                  border: OutlineInputBorder(),
                  prefixText: 'Rs. ',
                ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: () {
                  setDialogState(() {
                    codAvailable = !codAvailable;
                  });
                },
                child: Row(
                  children: [
                    Checkbox(
                      value: codAvailable,
                      onChanged: (value) {
                        setDialogState(() {
                          codAvailable = value ?? true;
                        });
                      },
                    ),
                    const Text('COD Available'),
                  ],
                ),
              ),
              CheckboxListTile(
                value: codAvailable,
                onChanged: (value) {
                  setDialogState(() {
                    codAvailable = value ?? true;
                  });
                },
                activeColor: Colors.green,
                title: Text(
                  'COD Available',
                  style: TextStyle(
                    fontWeight:
                        codAvailable ? FontWeight.bold : FontWeight.normal,
                    color: codAvailable ? Colors.green[800] : Colors.black87,
                  ),
                ),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (nameController.text.isEmpty ||
                          priceController.text.isEmpty) {
                        return;
                      }

                      setDialogState(() {
                        isSubmitting = true;
                      });

                      try {
                        final price = double.parse(priceController.text);
                        await _createZone(
                            nameController.text, price, codAvailable);
                        if (context.mounted) {
                          Navigator.pop(context);
                          _loadZones();
                        }
                      } catch (e) {
                        setDialogState(() {
                          isSubmitting = false;
                        });
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Failed to create zone')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green[700],
                foregroundColor: Colors.white,
              ),
              child: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  void _showEditZoneDialog(dynamic zone) {
    final nameController = TextEditingController(text: zone['name']);
    final priceController =
        TextEditingController(text: zone['price'].toString());
    bool codAvailable = zone['cod_available'] ?? true;
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit Delivery Zone'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Zone Name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Delivery Price',
                  border: OutlineInputBorder(),
                  prefixText: 'Rs. ',
                ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: () {
                  setDialogState(() {
                    codAvailable = !codAvailable;
                  });
                },
                child: Row(
                  children: [
                    Checkbox(
                      value: codAvailable,
                      onChanged: (value) {
                        setDialogState(() {
                          codAvailable = value ?? true;
                        });
                      },
                    ),
                    const Text('COD Available'),
                  ],
                ),
              ),
              CheckboxListTile(
                value: codAvailable,
                onChanged: (value) {
                  setDialogState(() {
                    codAvailable = value ?? true;
                  });
                },
                activeColor: Colors.green,
                title: Text(
                  'COD Available',
                  style: TextStyle(
                    fontWeight:
                        codAvailable ? FontWeight.bold : FontWeight.normal,
                    color: codAvailable ? Colors.green[800] : Colors.black87,
                  ),
                ),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (nameController.text.isEmpty ||
                          priceController.text.isEmpty) {
                        return;
                      }

                      setDialogState(() {
                        isSubmitting = true;
                      });

                      try {
                        final price = double.parse(priceController.text);
                        await _updateZone(
                          zone['id'],
                          nameController.text,
                          price,
                          codAvailable,
                        );
                        if (context.mounted) {
                          Navigator.pop(context);
                          _loadZones();
                        }
                      } catch (e) {
                        setDialogState(() {
                          isSubmitting = false;
                        });
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Failed to update zone')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue[700],
                foregroundColor: Colors.white,
              ),
              child: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteZone(int zoneId, String zoneName) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Zone'),
        content: Text('Are you sure you want to delete "$zoneName"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await _deleteZone(zoneId);
                _loadZones();
                if (mounted) {
                  // ignore: use_build_context_synchronously
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Zone deleted')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  // ignore: use_build_context_synchronously
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to delete zone')),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[700],
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Delivery Zones'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorMessage!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadZones,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _zones.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.local_shipping_outlined,
                            size: 64,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No delivery zones yet',
                            style: TextStyle(
                              fontSize: 18,
                              color: Colors.grey[600],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Add your first delivery zone',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _zones.length,
                      itemBuilder: (context, index) {
                        final zone = _zones[index];
                        final codAvailable = zone['cod_available'] ?? false;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.grey[300]!),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            zone['name'],
                                            style: const TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Rs. ${zone['price']}',
                                            style: TextStyle(
                                              fontSize: 16,
                                              color: Colors.blue[700],
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined),
                                      color: Colors.blue[700],
                                      onPressed: () =>
                                          _showEditZoneDialog(zone),
                                      tooltip: 'Edit',
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline),
                                      color: Colors.red[700],
                                      onPressed: () => _confirmDeleteZone(
                                        zone['id'],
                                        zone['name'],
                                      ),
                                      tooltip: 'Delete',
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: codAvailable
                                        ? Colors.green[50]
                                        : Colors.grey[200],
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: codAvailable
                                          ? Colors.green[300]!
                                          : Colors.grey[400]!,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        codAvailable
                                            ? Icons.check_circle
                                            : Icons.cancel,
                                        size: 16,
                                        color: codAvailable
                                            ? Colors.green[700]
                                            : Colors.grey[600],
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        codAvailable
                                            ? 'COD Available'
                                            : 'COD Not Available',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                          color: codAvailable
                                              ? Colors.green[700]
                                              : Colors.grey[600],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddZoneDialog,
        backgroundColor: Colors.green[700],
        icon: const Icon(Icons.add),
        label: const Text('Add Zone'),
      ),
    );
  }
}
