
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    delay,
    DisconnectReason
} = require('@whiskeysockets/baileys')

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_mikail')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        browser: Browsers.macOS('Intro Bot Mikail'),
        
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
            console.log('✅ Terhubung ke WhatsApp!')
            await kirimPerkenalan(sock)
        } else if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            if (code !== DisconnectReason.loggedOut) {
                console.log('🔁 Mencoba konek ulang...')
                connectBot()
            } else {
                console.log('❌ Logout. Silakan pairing ulang.')
            }
        }
    })

    // Pairing code kalau belum login
    if (!sock.authState.creds.registered) {
        const phoneNumber = '6285860462060'
        const code = await sock.requestPairingCode(phoneNumber)
        console.log(`📟 Pairing Code untuk ${phoneNumber}: ${code}`)
    }
}

async function kirimPerkenalan(sock) {
    const cooldown = 50000 // 5 detik
    const contacts = await sock.getContacts()

    const pesan = `📩 *Assalamualaikum Wr. Wb.*

Ini *Mikail* — saya menggunakan *nomor baru* karena akun WhatsApp lama saya:
❗ *Telah dihack*
❌ *Diblokir oleh WhatsApp*

Mohon hati-hati: Jika ada yang *mengatasnamakan Mikail* dari nomor lain, itu *BUKAN saya.*

📲 Tolong simpan nomor ini. Terima kasih banyak atas pengertiannya.
🙏 Auto Sender By Mike`

    console.log(`📬 Mengirim pesan ke ${contacts.length} kontak dengan jeda ${cooldown / 1000} detik...`)

    for (const contact of contacts) {
        try {
            if (contact.id.endsWith('@s.whatsapp.net')) {
                await sock.sendMessage(contact.id, { text: pesan })
                console.log(`✅ Terkirim ke ${contact.id}`)
                await delay(cooldown)
            }
        } catch (err) {
            console.log(`⚠️ Gagal ke ${contact.id}: ${err.message}`)
        }
    }

    console.log('🎉 Semua pesan selesai dikirim.')
}

connectBot()
