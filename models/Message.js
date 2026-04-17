const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    author: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 280
    },
    date: {
        type: Date,
        default: Date.now
    },
    recipient: {
        type: String,
        default: null
    },
    likes: {
        type: [String],
        default: []
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    }
});

messageSchema.index({ date: -1 });
messageSchema.index({ parentId: 1 });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
