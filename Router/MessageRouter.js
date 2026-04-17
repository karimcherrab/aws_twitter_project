const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token d\'authentification requis' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token invalide ou expiré' });
        }
        req.user = user;
        next();
    });
};

// GET /messages — top-level public tweets with reply counts
router.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find({ recipient: null, parentId: null })
            .sort({ date: -1 })
            .limit(100);

        const ids = messages.map(m => m._id);
        const replyCounts = await Message.aggregate([
            { $match: { parentId: { $in: ids } } },
            { $group: { _id: '$parentId', count: { $sum: 1 } } }
        ]);

        const replyCountMap = {};
        replyCounts.forEach(r => { replyCountMap[r._id.toString()] = r.count; });

        const result = messages.map(m => ({
            ...m.toObject(),
            replyCount: replyCountMap[m._id.toString()] || 0
        }));

        res.json({ success: true, messages: result });

    } catch (error) {
        console.error('Erreur récupération messages:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages' });
    }
});

// POST /post — publish a top-level tweet
router.post('/post', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Le message ne peut pas être vide' });
        }
        if (text.length > 280) {
            return res.status(400).json({ success: false, message: 'Le message ne peut pas dépasser 280 caractères' });
        }

        const message = new Message({ author: req.user.username, text: text.trim() });
        await message.save();

        res.status(201).json({ success: true, message: 'Message publié avec succès', data: message });

    } catch (error) {
        console.error('Erreur publication message:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la publication du message' });
    }
});

// POST /private — send a private message
router.post('/private', authenticateToken, async (req, res) => {
    try {
        const { text, recipient } = req.body;
        const author = req.user.username;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Le message ne peut pas être vide' });
        }
        if (text.length > 280) {
            return res.status(400).json({ success: false, message: 'Le message ne peut pas dépasser 280 caractères' });
        }
        if (!recipient || recipient.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Destinataire requis' });
        }
        if (recipient.trim() === author) {
            return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous envoyer un message à vous-même' });
        }

        const recipientUser = await User.findOne({ username: recipient.trim() });
        if (!recipientUser) {
            return res.status(404).json({ success: false, message: 'Destinataire introuvable' });
        }

        const message = new Message({ author, text: text.trim(), recipient: recipient.trim() });
        await message.save();

        res.status(201).json({ success: true, message: 'Message privé envoyé', data: message });

    } catch (error) {
        console.error('Erreur message privé:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message privé' });
    }
});

// GET /inbox — received private messages
router.get('/inbox', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({ recipient: req.user.username })
            .sort({ date: -1 })
            .limit(50);

        res.json({ success: true, messages });

    } catch (error) {
        console.error('Erreur inbox:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la boîte de réception' });
    }
});

// GET /replies/:id — get replies for a tweet (public)
router.get('/replies/:id', async (req, res) => {
    try {
        const replies = await Message.find({ parentId: req.params.id })
            .sort({ date: 1 })
            .limit(50);

        res.json({ success: true, replies });

    } catch (error) {
        console.error('Erreur récupération réponses:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des réponses' });
    }
});

// POST /reply/:id — post a reply to a tweet
router.post('/reply/:id', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'La réponse ne peut pas être vide' });
        }
        if (text.length > 280) {
            return res.status(400).json({ success: false, message: 'La réponse ne peut pas dépasser 280 caractères' });
        }

        const parent = await Message.findById(req.params.id);
        if (!parent) {
            return res.status(404).json({ success: false, message: 'Tweet introuvable' });
        }

        const reply = new Message({
            author: req.user.username,
            text: text.trim(),
            parentId: req.params.id
        });
        await reply.save();

        res.status(201).json({ success: true, reply });

    } catch (error) {
        console.error('Erreur réponse:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la publication de la réponse' });
    }
});

// POST /like/:id — toggle like on a tweet or reply
router.post('/like/:id', authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message introuvable' });
        }

        const username = req.user.username;
        if (!message.likes) message.likes = [];

        const idx = message.likes.indexOf(username);
        if (idx === -1) {
            message.likes.push(username);
        } else {
            message.likes.splice(idx, 1);
        }

        await message.save();

        res.json({ success: true, likes: message.likes.length, liked: idx === -1 });

    } catch (error) {
        console.error('Erreur like:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du like' });
    }
});

module.exports = router;
