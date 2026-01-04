import 'package:flutter/material.dart';
import '../services/variant_service.dart';

class VariantsScreen extends StatefulWidget {
  final int productId;
  final String productName;

  const VariantsScreen({
    super.key,
    required this.productId,
    required this.productName,
  });

  @override
  State<VariantsScreen> createState() => _VariantsScreenState();
}

class _VariantsScreenState extends State<VariantsScreen> {
  List<dynamic> _variants = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadVariants();
  }

  Future<void> _loadVariants() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final variants = await VariantService.getVariants(widget.productId);
      setState(() {
        _variants = variants;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load variants';
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleAvailability(int variantId, bool currentValue) async {
    try {
      await VariantService.updateVariantAvailability(variantId, !currentValue);
      _loadVariants();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update variant')),
        );
      }
    }
  }

  void _showAddVariantDialog() {
    final colorController = TextEditingController();
    String selectedSize = 'M';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 16,
            right: 16,
            top: 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Add Variant',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: colorController,
                decoration: const InputDecoration(
                  labelText: 'Color',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedSize,
                decoration: const InputDecoration(
                  labelText: 'Size',
                  border: OutlineInputBorder(),
                ),
                items: ['S', 'M', 'L', 'XL', 'XXL']
                    .map((size) => DropdownMenuItem(
                          value: size,
                          child: Text(size),
                        ))
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setModalState(() {
                      selectedSize = value;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (colorController.text.isEmpty) {
                    return;
                  }

                  try {
                    await VariantService.createVariant(
                      widget.productId,
                      colorController.text,
                      selectedSize,
                    );
                    if (context.mounted) {
                      Navigator.pop(context);
                      _loadVariants();
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Failed to create variant')),
                      );
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[700],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Add Variant'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(widget.productName),
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
                        onPressed: _loadVariants,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _variants.isEmpty
                  ? const Center(
                      child: Text('No variants yet. Add your first variant!'),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadVariants,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _variants.length,
                        itemBuilder: (context, index) {
                          final variant = _variants[index];
                          final isAvailable = variant['available'] == true;

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: BorderSide(color: Colors.grey[300]!),
                            ),
                            child: ListTile(
                              title: Text(
                                '${variant['color']} - ${variant['size']}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                isAvailable ? 'Available' : 'Out of stock',
                                style: TextStyle(
                                  color: isAvailable
                                      ? Colors.green[700]
                                      : Colors.red[700],
                                  fontSize: 14,
                                ),
                              ),
                              trailing: Switch(
                                value: isAvailable,
                                onChanged: (value) {
                                  _toggleAvailability(
                                      variant['id'], isAvailable);
                                },
                                activeThumbColor: Colors.green,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddVariantDialog,
        backgroundColor: Colors.blue[700],
        child: const Icon(Icons.add),
      ),
    );
  }
}
