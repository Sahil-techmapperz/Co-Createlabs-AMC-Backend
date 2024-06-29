const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Function to generate unique 8-digit number
const generateUniqueIssueId = async () => {
    let uniqueId;
    let issueReport;
    do {
        uniqueId = Math.floor(10000000 + Math.random() * 90000000).toString();
        issueReport = await IssueReport.findOne({ issueId: uniqueId });
    } while (issueReport);
    return uniqueId;
};

// Schema for Issue Report
const issueReportSchema = new Schema({
    issueId: { type: String, unique: true },
    issue: { type: String, required: true },
    repotedTime: { type: Date, required: true },
    repotedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: { type: String, enum: ['Pending', 'Resolve', 'In Progress'], default: 'Pending' },
    reply: { type: String }
}, { timestamps: true });

// Middleware to generate unique issueId before saving
issueReportSchema.pre('save', async function (next) {
    if (!this.issueId) {
        this.issueId = await generateUniqueIssueId();
    }
    next();
});

// Create and export the IssueReport model
const IssueReport = mongoose.model('IssueReport', issueReportSchema);
module.exports = IssueReport;
