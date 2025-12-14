// Dosya Adı: netlify/functions/gemini-proxy.js
// Bu kod Node.js ortamında (Sunucuda) çalışır ve sohbet geçmişini destekler.

const fetch = require('node-fetch'); 

exports.handler = async (event, context) => {
    // 1. GİZLİ API Anahtarını Ortam Değişkenlerinden Güvenli Şekilde Al
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    if (!GOOGLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API Anahtarı bulunamadı. Lütfen Netlify Ortam Değişkenlerini kontrol edin." })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // 2. İstemciden (Browser) Gelen VERİLERİ YAKALA (history ve systemInstruction)
        const { contents, systemInstruction } = JSON.parse(event.body); // <-- DÜZELTME: systemInstruction eklendi

        // Zorunlu Kontrol: Geçmiş boş gelmemeli ve doğru yapıda olmalı
        if (!contents || !Array.isArray(contents)) {
             return { statusCode: 400, body: JSON.stringify({ error: "Sohbet geçmişi (contents) formatı geçersiz." }) };
        }

        const MODEL_NAME = "gemini-2.5-flash"; 

        // 3. Gemini API'ye Güvenli Çağrı Yap
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GOOGLE_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                // Artık temizlenmiş user/model döngüsü
                contents: contents ,  
                systemInstruction: {
                    parts: [
                        { text: systemInstruction } // DÜZELTME: systemInstruction eklendi
                    ]
                }
            })
        });

        const data = await geminiResponse.json();

        // Hata kontrolü
        if (data.error) {
            // Kota aşım hatalarını istemciye net bir şekilde döndürmek için
            return {
                statusCode: data.error.code || 500,
                body: JSON.stringify({ error: { 
                    code: data.error.code || 500,
                    message: data.error.message 
                }})
            };
        }

        // 4. Cevabı Temizleyip İstemciye Geri Gönder
        const aiResponseText = data.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            body: JSON.stringify({ text: aiResponseText }) // 'text' olarak gönderiyoruz
        };

    } catch (error) {
        console.error("Netlify Fonksiyon Hatası:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Sunucu tarafında bilinmeyen bir hata oluştu." })
        };
    }
};