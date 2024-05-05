const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const articleSchema = new Schema({
    bannerimage: { type: String, required: true }, 
    title: { type: String, required: true },
    description: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: String, required: true } 
});

const article = mongoose.model('Article', articleSchema);

module.exports = article;
