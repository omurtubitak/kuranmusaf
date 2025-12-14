
    // --- KONFIGURASYON VE GLOBAL TANIMLAR --- 
    const API_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/tur-elmalilihamdiya.json";
    
    // Firebase Yapılandırması (Sizin projenize özel)
    const firebaseConfig = {
        apiKey: "AIzaSyCHgB_98b91ID0M_xsrmLU2waz3bACym4Y",
        authDomain: "kuranmusaf-6d278.firebaseapp.com",
        projectId: "kuranmusaf-6d278",
        storageBucket: "kuranmusaf-6d278.firebasestorage.app",
        messagingSenderId: "166160261620",
        appId: "1:166160261620:web:c5ca3cc8a1e5df59a7d9a1",
        measurementId: "G-RM38S3CZ89"
    };

    // Firebase'i Başlat
    const app = firebase.initializeApp(firebaseConfig);
    const auth = app.auth();
    const dbFirestore = app.firestore();

    let currentUser = null; // Aktif kullanıcı objesi

    // Veri ve Geçmiş
    let quranData = [];  
    let chatHistory = []; 
    const MAX_TURNS = 3; // Token yönetimi için maksimum soru-cevap çifti (20 mesaj)

    // 1. Dexie ile IndexedDB (Anonim kullanıcılar için)
    const db = new Dexie("MahirChatDB");
    db.version(1).stores({
        history: 'id' 
    });
    
    // Surah İsimleri (TEK TANIM)
    const surahNames = [
        "Fâtiha", "Bakara", "Âl-i İmrân", "Nisâ", "Mâide", "En'âm", "A'râf", "Enfâl", "Tevbe", "Yûnus",
        "Hûd", "Yûsuf", "Ra'd", "İbrâhîm", "Hicr", "Nahl", "İsrâ", "Kehf", "Meryem", "Tâhâ",
        "Enbiyâ", "Hac", "Mü'minûn", "Nûr", "Furkân", "Şu'arâ", "Neml", "Kasas", "Ankebût", "Rûm",
        "Lokmân", "Secde", "Ahzâb", "Sebe'", "Fâtır", "Yâsîn", "Sâffât", "Sâd", "Zümer", "Mü'min",
        "Fussilet", "Şûrâ", "Zuhruf", "Duhân", "Câsiye", "Ahkâf", "Muhammed", "Fetih", "Hucurât", "Kâf",
        "Zâriyât", "Tûr", "Necm", "Kamer", "Rahmân", "Vâkı'a", "Hadîd", "Mücâdele", "Haşr", "Mümtehine",
        "Saf", "Cum'a", "Münâfikûn", "Teğâbun", "Talâk", "Tahrîm", "Mülk", "Kalem", "Hâkka", "Me'âric",
        "Nûh", "Cin", "Müzzemmil", "Müddessir", "Kıyâme", "İnsân", "Mürselât", "Nebe'", "Nâzi'ât", "Abese",
        "Tekvîr", "İnfitâr", "Mutaffifîn", "İnşikâk", "Burûc", "Târık", "A'lâ", "Gâşiye", "Fecr", "Beled",
        "Şems", "Leyl", "Duhâ", "İnşirâh", "Tîn", "Alak", "Kadir", "Beyyine", "Zilzâl", "Âdiyât",
        "Kâri'a", "Tekâsür", "Asr", "Hümeze", "Fîl", "Kureyş", "Mâ'ûn", "Kevser", "Kâfirûn", "Nasr",
        "Tebbet", "İhlâs", "Felak", "Nâs"
    ];


    // --- BAŞLANGIÇ ---
    document.addEventListener("DOMContentLoaded", async () => {
        renderSidebar();
        document.getElementById('searchInput').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') performSearch();
        });

        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            quranData = data.quran;
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            alert("Kuran verileri yüklenirken hata oluştu: " + error);
        }
        
        // NOT: İlk sohbet geçmişi yüklemesi (IndexedDB veya Firestore) artık tamamen 
        // auth.onAuthStateChanged içinde yönetiliyor.
    });

    // --- TEMEL GÖRÜNÜM VE ARAMA FONKSİYONLARI ---

    function renderSidebar() {
        const listContainer = document.getElementById('surahList');
        let html = '';
        surahNames.forEach((name, index) => {
            const surahNo = index + 1;
            html += `<div class="surah-item" onclick="loadSurah(${surahNo})" id="surah-${surahNo}">
                    <span><strong>${surahNo}.</strong> ${name}</span>
                 </div>`;
        });
        listContainer.innerHTML = html;
    }

    function loadSurah(surahNo) {
        document.getElementById('searchInput').value = '';
        document.querySelectorAll('.surah-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`surah-${surahNo}`);
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        const verses = quranData.filter(v => v.chapter === surahNo);
        const container = document.getElementById('verseContainer');
        const surahName = surahNames[surahNo - 1];

        let contentHtml = `<div class="text-center mb-4"><h2 style="color:var(--primary-color);">${surahName} Suresi</h2><hr style="width: 50px; margin: 10px auto; border-top: 3px solid var(--primary-color);"></div>`;
        if (surahNo !== 9) contentHtml += `<div class="besmele">Bismillahirrahmanirrahim</div>`;

        verses.forEach(verse => {
            const verseCode = `${verse.chapter}/${verse.verse}`;
            contentHtml += `<div class="verse-card" id="verse-${verseCode}">
                        <div class="d-flex">
                            <span class="verse-number">${verse.verse}</span>
                            <div class="verse-text w-100">${verse.text}</div>
                        </div>
                        <div class="text-end mt-2">
                            <button class="btn btn-sm btn-outline-secondary" 
                                    onclick="askMahireForVerseCode('${verseCode}', '${surahName}')">
                                <i class="fas fa-question-circle me-1"></i> ${verseCode} Hakkında Mahire Sor
                            </button>
                        </div>
                    </div>`;
        });
        container.scrollTop = 0;
        container.innerHTML = contentHtml;
    }

    function askMahireForVerseCode(verseCode, surahName) {
        const question = `${surahName} suresindeki ${verseCode} ayetinin İslami açıklamasını ve tefsirini yap.`;
        toggleChat(true);
        const inputEl = document.getElementById('aiInput');
        inputEl.value = question;
        askGemini();
    }

    function toggleChat(forceOpen = false) {
        const win = document.getElementById('chatWindow');
        if (forceOpen) {
            win.style.display = 'flex';
        } else {
            win.style.display = (win.style.display === 'none' || win.style.display === '') ? 'flex' : 'none';
        }
    }

    function performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (query.length < 2) { alert("En az 2 karakter girin."); return; }

        const lowerQuery = query.toLocaleLowerCase('tr-TR');
        const results = quranData.filter(verse => verse.text.toLocaleLowerCase('tr-TR').includes(lowerQuery));

        const container = document.getElementById('verseContainer');
        if (results.length === 0) {
            container.innerHTML = `<div class="text-center mt-5">Sonuç bulunamadı.</div>`;
            return;
        }

        let html = `<div class="alert alert-info">"${query}" için ${results.length} sonuç bulundu.</div>`;
        results.forEach(verse => {
            const sName = surahNames[verse.chapter - 1];
            const regex = new RegExp(`(${query})`, 'gi');
            const highlighted = verse.text.replace(regex, '<mark>$1</mark>');

            html += `<div class="verse-card"><small class="text-muted text-uppercase">${sName} ${verse.chapter}/${verse.verse}</small><div class="d-flex mt-2">
                     <span class="verse-number" style="width:25px;height:25px;font-size:0.7rem;line-height:25px">${verse.verse}</span>
                    <div class="verse-text w-100">${highlighted}</div>
                </div></div>`;
        });
        container.scrollTop = 0;
        container.innerHTML = html;
    }

    function handleEnter(e) {
        if (e.key === 'Enter') askGemini();
    }
    
    // --- YARDIMCI VE UI FONKSİYONLARI ---

    function appendMessage(role, text) {
        const chatBody = document.getElementById('chatBody');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.innerHTML = marked.parse(text);
        chatBody.appendChild(msgDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // UI'ı güncelleyen yardımcı fonksiyon (Başlangıç mesajı hariç temizlendi)
    function refreshChatUI() {
        document.getElementById('chatBody').innerHTML = '';
        
        // HTML'deki başlangıç mesajı ile uyumlu olması için yeniden eklenir
        document.getElementById('chatBody').innerHTML = `<div class="message ai">Selamun Aleyküm! Ben Mahir, Kuran Asistanıyım. Genel İslami bilgi, tefsir ve Kuran konularında size yardımcı olabilirim.</div>`;
        
        chatHistory.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'model') {
                // Sistem talimatlarını göstermeyi atla
                if (!msg.parts[0].text.startsWith('[KONUŞMA BAŞLANGICI]')) {
                    appendMessage(msg.role, msg.parts[0].text);
                }
            }
        });
        const chatBody = document.getElementById('chatBody');
        chatBody.scrollTop = chatBody.scrollHeight;
    }


    // --- INDEXEDDB FONKSİYONLARI (Anonim Kullanıcılar) ---

    async function loadIndexedDBChatHistory() {
        try {
            const record = await db.history.get(1);
            if (record && record.messages) {
                chatHistory = record.messages;
                console.log("Geçmiş IndexedDB'den yüklendi.");
            } else {
                chatHistory = [];
            }
        } catch (error) {
            console.error("IndexedDB yükleme hatası:", error);
            chatHistory = [];
        }
    }

    async function saveIndexedDBChatHistory() {
        try {
            await db.history.put({ id: 1, messages: chatHistory });
            // console.log("Geçmiş IndexedDB'ye kaydedildi.");
        } catch (error) {
            console.error("Geçmiş kaydetme hatası:", error);
        }
    }

    // --- FIREBASE AUTH VE FIRESTORE YÖNETİMİ ---

    // Kullanıcı durumuna göre veri yükleme (Firestore veya IndexedDB)
    async function conditionalLoadChatHistory(user) {
        if (user) {
            // Oturum Açık: Firestore'dan çek
            console.log("Kullanıcı oturumu açık. Firestore'dan yükleniyor...");
            try {
                const doc = await dbFirestore.collection("users").doc(user.uid).get();
                if (doc.exists && doc.data().chatHistory) {
                    chatHistory = doc.data().chatHistory;
                    console.log("Firestore geçmişi yüklendi.");
                } else {
                    chatHistory = [];
                    console.log("Firestore'da geçmiş bulunamadı.");
                }
            } catch (e) {
                console.error("Firestore yükleme hatası:", e);
                chatHistory = [];
            }
        } else {
            // Oturum Kapalı: IndexedDB'den çek
            console.log("Anonim kullanıcı. IndexedDB'den yükleniyor...");
            await loadIndexedDBChatHistory(); 
        }
        
        // Yüklenen geçmişi UI'ya aktar
        refreshChatUI();
    }

    // Koşullu Kaydetme (askGemini'den çağrılır)
    async function saveChatHistory() {
        if (currentUser) {
            // Oturum Açık: Firestore'a kaydet
            try {
                await dbFirestore.collection("users").doc(currentUser.uid).set({
                    chatHistory: chatHistory,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                // console.log("Geçmiş Firestore'a kaydedildi.");
            } catch (error) {
                console.error("Firestore kaydetme hatası:", error);
            }
        } else {
            // Oturum Kapalı: IndexedDB'ye kaydet
            await saveIndexedDBChatHistory(); 
        }
    }

    // Giriş/Kayıt İşlemleri
    function handleAuthClick() {
        if (currentUser) {
            // Çıkış Yap
            auth.signOut();
        } else {
            // Giriş Yap/Kaydol
            const email = prompt("Lütfen e-posta adresinizi girin:");
            const password = prompt("Lütfen şifrenizi girin:");
            if (!email || !password) return;

            auth.signInWithEmailAndPassword(email, password)
                .catch((error) => {
                    // Giriş başarısızsa, kaydolmayı dene
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                         auth.createUserWithEmailAndPassword(email, password)
                            .then(() => alert("Kayıt başarılı! Hoşgeldiniz. Lütfen tekrar giriş yapın.")) // Kayıt başarılı uyarısını netleştirdim
                            .catch(e => alert("Kayıt veya Giriş Hatası: " + e.message));
                    } else {
                        alert("Giriş Hatası: " + error.message);
                    }
                });
        }
    }

    // Firebase Oturum Dinleyicisi (Kritik - Sayfa Yüklemesindeki ilk yüklemeyi de yönetir)
    auth.onAuthStateChanged(async (user) => {
        const statusEl = document.getElementById('userStatus');
        const authBtn = document.getElementById('authBtn');
        
        currentUser = user; // Global değişkeni güncelle

        if (user) {
            statusEl.innerHTML = `<i class="fas fa-user-check me-1"></i> ${user.email.substring(0, 15)}...`;
            authBtn.textContent = "Çıkış Yap";
            // Firestore'dan veriyi çek
            await conditionalLoadChatHistory(user);

        } else {
            statusEl.innerHTML = `<i class="fas fa-user-circle me-1"></i> Anonim`;
            authBtn.textContent = "Giriş Yap";
            // IndexedDB'den veriyi çek
            await conditionalLoadChatHistory(null);
        }
    });


    // --- ANA API VE SOHBET YÖNETİM FONKSİYONU --- 
    // --- ANA API VE SOHBET YÖNETİM FONKSİYONU ---

async function askGemini() {
    const inputEl = document.getElementById('aiInput');
    const userQuery = inputEl.value.trim();
    if (!userQuery) return;

    appendMessage("user", userQuery);
    inputEl.value = '';
    document.getElementById('typingIndicator').style.display = 'block';
    const chatBody = document.getElementById('chatBody');
    chatBody.scrollTop = chatBody.scrollHeight;

    // Sistem talimatı
    // Önerilen Temizlenmiş System Instruction
    const systemInstruction = `Sen, görevi sadece İslami ve ahlaki çerçevede, kibar ve saygılı dille cevap vermek olan uzman bir İslami asistanssın (Mahir). Kapsamlı bilginle Kuran ve din sorularını yanıtla. Cevapların Diyanet İşleri görüşüne uygun olmalıdır. KESİNLİKLE YASAK: Ahlaki, etik dışı, şiddet veya cinsel içerikli soruları kibar ama net bir RED cevabıyla ("Bu konular etik sınırlarımı aşmaktadır, lütfen dini bir soru sorun.") reddet. Cevaplarını Türkçe ve akademik üslupla sun.`;
    // Geçmişin kopyasını oluştur (API'ye bunu göndereceğiz)
    let historyToSend = [...chatHistory]; 
    
    // 1. KONUŞMA PENCERESİ YÖNETİMİ (Token sınırını aşmamak için)
    const currentMaxMessages = (MAX_TURNS * 2);

    if (historyToSend.length > currentMaxMessages) { 
        // En baştaki 2 öğeyi (En eski soru ve cevabı) sil.
        historyToSend.splice(0, 2); 
        console.warn("Sohbet geçmişi penceresi doldu, en eski mesajlar silindi.");
    }

    // 2. KULLANICININ YENİ SORUSUNU GEÇMİŞE EKLE
    historyToSend.push({
        role: "user", 
        parts: [{ text: userQuery }] 
    });

    try {
        const response = await fetch('/.netlify/functions/gemini-proxy', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: historyToSend,  
                systemInstruction: systemInstruction
            })
        });

        const data = await response.json();

        document.getElementById('typingIndicator').style.display = 'none';

        if (data.error) {
            let errorMessage = `API Hatası: ${data.error.message || data.error || 'Sunucu fonksiyonu hatası.'}`;
            
            // 🛑 Kota aşım hatası yakalama ve dengeleyici mekanizma
            if (errorMessage.includes("Quota exceeded") || errorMessage.includes("limit: 20")) {
                 errorMessage = "⚠️ Yoğun talep nedeniyle Google'ın ücretsiz kullanım limiti anlık olarak doldu. Lütfen birkaç dakika sonra tekrar deneyin.";
                 
                 // EK GÜVENLİK ADIMI: chatHistory'yi küçült
                 if (chatHistory.length > 2) { // 2'den büyükse (yani 1 soru + 1 cevapdan fazla varsa)
                     // Geçici olarak geçmişi son 2 mesaja indir (En son soru + cevap)
                     // Sistem talimatı artık geçmişte olmadığı için bu slice mantığı doğrudur.
                     chatHistory = chatHistory.slice(-2); 
                     console.warn("Kota aşımı sonrası, token tasarrufu için geçmiş sadece son 2 mesaja düşürüldü.");
                 }
            }

            appendMessage("ai", errorMessage);
            // Hata durumunda son eklenen kullanıcı mesajını tarihten çıkar (tekrar denesin)
            chatHistory.pop();
        } else {
            const aiResponseText = data.text;
            appendMessage("ai", aiResponseText);

            // AI cevabını tarihe ekle (Ana geçmişe eklenir)
            chatHistory.push({
                role: "model",
                parts: [{ text: aiResponseText }]
            });

            // Başarılı işlemden sonra Firestore veya IndexedDB'ye kaydet
            saveChatHistory(); 
        }

    } catch (err) {
        document.getElementById('typingIndicator').style.display = 'none';
        appendMessage("ai", "Bağlantı hatası oluştu. Netlify fonksiyonunun çalıştığından emin olun.");
        chatHistory.pop(); 
        console.error(err);
    }
}

 