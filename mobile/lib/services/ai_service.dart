import 'dart:convert';
import 'package:http/http.dart' as http;

class AiService {
  static const String baseUrl = 'http://192.168.100.22:4000/api';

  static Future<List<String>> suggestReply(String customerMessage) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ai/suggest-reply'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'customerMessage': customerMessage,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to get AI suggestion');
    }

    final data = jsonDecode(response.body);
    return List<String>.from(data['suggestions']);
  }
}