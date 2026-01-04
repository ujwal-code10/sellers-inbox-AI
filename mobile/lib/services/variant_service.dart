import 'dart:convert';
import 'package:http/http.dart' as http;

class VariantService {
  static const String baseUrl = 'http://192.168.100.22:4000';
  static const String token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzY2ODEwMzkzLCJleHAiOjE3Njk0MDIzOTN9.j19l4aHF1juvjCUveOaDbFfAd70_1alB1oH-LeijsWo';

  static Future<List<dynamic>> getVariants(int productId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/products/$productId/variants'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load variants');
    }
  }

  static Future<Map<String, dynamic>> createVariant(
      int productId, String color, String size) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/products/$productId/variants'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'color': color,
        'size': size,
        'available': true,
      }),
    );

    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to create variant');
    }
  }

  static Future<void> updateVariantAvailability(
      int variantId, bool available) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/variants/$variantId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'available': available,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to update variant');
    }
  }
}
