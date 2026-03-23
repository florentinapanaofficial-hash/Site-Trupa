/**
 * gdpr/schema-gdpr-mongo.js
 * ══════════════════════════════════════════════════════════════════════
 * Schema Mongoose – MongoDB
 * Colecție: gdpr_consimtamant
 *
 * Caracteristici:
 *   • TTL Index → MongoDB șterge automat documentele după 12 luni
 *   • IP hașat cu SHA-256 + salt din env (nu se stochează IP brut)
 *   • Soft delete (sters_la) pentru audit post-ștergere
 *   • Validare enum strictă pentru tip_consimtamant și canal
 *
 * Utilizare:
 *   import { Consimtamant } from './schema-gdpr-mongo.js';
 *
 *   // Salvare cu IP hașat automat:
 *   await Consimtamant.creeazaCuIpHash({
 *     tip_consimtamant: 'whatsapp_redirect',
 *     canal:            'whatsapp',
 *     ip_brut:          '192.168.1.1',
 *     user_agent:       'Mozilla/5.0...',
 *     referer:          'https://site.ro/contact',
 *   });
 */

import mongoose from 'mongoose';
import crypto from 'crypto'; // modul nativ Node.js – fără dependențe externe

// ──────────────────────────────────────────────────────────────────────
// 1. Schema Mongoose
// ──────────────────────────────────────────────────────────────────────

const consimtamantSchema = new mongoose.Schema(
    {
        /**
         * Tipul acțiunii pentru care s-a dat consimțământul.
         * Enum strict – valorile nepermise sunt respinse de Mongoose.
         */
        tip_consimtamant: {
            type: String,
            required: [true, 'tip_consimtamant este obligatoriu'],
            enum: {
                values: ['whatsapp_redirect', 'phone_call', 'email_contact'],
                message: 'tip_consimtamant "{VALUE}" nu este permis',
            },
            index: true,
        },

        /** Canalul de comunicare ales de utilizator */
        canal: {
            type: String,
            required: [true, 'canal este obligatoriu'],
            enum: {
                values: ['whatsapp', 'telefon', 'email'],
                message: 'canal "{VALUE}" nu este permis',
            },
        },

        /**
         * Hash SHA-256 al adresei IP.
         * IP-ul brut NU se stochează – minimizare date Art. 5 RGPD.
         * Hașarea se face în metoda statică `creeazaCuIpHash`.
         */
        ip_hash: {
            type: String,
            required: [true, 'ip_hash este obligatoriu'],
            index: true,
            // Validare format hex SHA-256 (64 caractere)
            validate: {
                validator: (v) => /^[0-9a-f]{64}$/.test(v),
                message: 'ip_hash trebuie să fie un hash SHA-256 valid (64 hex chars)',
            },
        },

        /**
         * User-Agent al browserului.
         * Primele 512 caractere – util pentru audit și detectare bot.
         */
        user_agent: {
            type: String,
            maxlength: [512, 'user_agent depășește 512 caractere'],
            default: null,
        },

        /**
         * URL-ul paginii de unde s-a dat consimțământul.
         * Primele 255 caractere (suficient pentru URL-uri practice).
         */
        referer: {
            type: String,
            maxlength: [255, 'referer depășește 255 caractere'],
            default: null,
        },

        /**
         * Versiunea documentului de politică confidențialitate acceptat.
         * Actualizați la orice schimbare semnificativă a politicii.
         */
        versiune_politica: {
            type: String,
            required: true,
            default: '1.0',
        },

        /**
         * Marcator soft delete.
         * null = consimțământ activ
         * Date() = data la care a fost marcat șters
         */
        sters_la: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        /**
         * Timestamps gestionați automat de Mongoose.
         * createdAt → redenumit data_consimtamant (conform cu schema SQL)
         * updatedAt → dezactivat (nu actualizăm consimțămintele)
         */
        timestamps: {
            createdAt: 'data_consimtamant',
            updatedAt: false,
        },

        // Previne salvarea câmpurilor nedefinite în schemă
        strict: true,
    },
);

// ──────────────────────────────────────────────────────────────────────
// 2. TTL Index – ștergere automată după 12 luni
//
// MongoDB verifică și șterge documentele expirate aproximativ la
// fiecare 60 de secunde. expireAfterSeconds se calculează de la
// câmpul data_consimtamant (createdAt).
//
// ATENȚIE: TTL index și soft delete sunt mecanisme separate.
// Dacă folosiți soft delete pentru audit, comentați TTL index-ul
// și implementați un job de ștergere fizică separat.
// ──────────────────────────────────────────────────────────────────────

consimtamantSchema.index(
    { data_consimtamant: 1 },
    {
        expireAfterSeconds: 60 * 60 * 24 * 365, // 365 zile = ~12 luni
        name: 'ttl_stergere_12_luni',
        background: true,
    },
);

// ──────────────────────────────────────────────────────────────────────
// 3. Index compus pentru interogări frecvente
// ──────────────────────────────────────────────────────────────────────

consimtamantSchema.index(
    { tip_consimtamant: 1, canal: 1 },
    { name: 'idx_tip_canal', background: true },
);

// ──────────────────────────────────────────────────────────────────────
// 4. Metode statice
// ──────────────────────────────────────────────────────────────────────

/**
 * Creează un consimțământ cu IP hașat automat.
 *
 * @param {object} date
 * @param {string} date.tip_consimtamant
 * @param {string} date.canal
 * @param {string} date.ip_brut            – IP-ul brut (nu se stochează)
 * @param {string} [date.user_agent]
 * @param {string} [date.referer]
 * @param {string} [date.versiune_politica]
 */
consimtamantSchema.statics.creeazaCuIpHash = async function (date) {
    if (!date?.ip_brut) {
        throw new Error('ip_brut este obligatoriu pentru hașare');
    }

    // Salt din variabile de mediu – previne rainbow table attacks
    // Dacă IP_HASH_SALT lipsește din .env, se folosește string gol (avertisment în log)
    const salt = process.env.IP_HASH_SALT ?? '';
    if (!salt) {
        console.warn('[GDPR] ATENȚIE: IP_HASH_SALT lipsește din .env. Setați un salt aleatoriu!');
    }

    const ipHash = crypto
        .createHash('sha256')
        .update(date.ip_brut + salt)
        .digest('hex');

    return this.create({
        tip_consimtamant: date.tip_consimtamant,
        canal: date.canal,
        ip_hash: ipHash,
        user_agent: date.user_agent ? date.user_agent.slice(0, 512) : null,
        referer: date.referer ? date.referer.slice(0, 255) : null,
        versiune_politica: date.versiune_politica ?? '1.0',
    });
};

/**
 * Soft delete: marchează toate înregistrările unui IP ca șterse.
 * Util pentru cererile de ștergere Art. 17 RGPD.
 *
 * @param {string} ipBrut    – IP-ul brut (se hașează pentru căutare)
 * @returns {number}          Numărul de înregistrări marcate
 */
consimtamantSchema.statics.stergePentruIp = async function (ipBrut) {
    const salt = process.env.IP_HASH_SALT ?? '';
    const ipHash = crypto.createHash('sha256').update(ipBrut + salt).digest('hex');

    const result = await this.updateMany(
        { ip_hash: ipHash, sters_la: null },
        { $set: { sters_la: new Date() } },
    );

    return result.modifiedCount;
};

// ──────────────────────────────────────────────────────────────────────
// 5. Export model
// ──────────────────────────────────────────────────────────────────────

/**
 * Model Mongoose exportat.
 * Verifică dacă modelul există deja (evită erori de recompilare în hot-reload).
 */
export const Consimtamant =
    mongoose.models.Consimtamant ??
    mongoose.model('Consimtamant', consimtamantSchema);
