const express = require('express');
const { ChatImageUpload_middleware, ChatFileUpload_middleware } = require('../middlewares/ChatFileUpload_middleware');
const router = express.Router();



router.get("/", (req, res) => {
    res.status(200).send("Hello from Chatmessage Route");
});

router.post("/uploadimage",ChatImageUpload_middleware, (req, res) => {
    let fileUrl= req.body.fileUrl;
    res.status(200).send({"Url":fileUrl});
});
router.post("/uploadfile",ChatFileUpload_middleware, (req, res) => {
    let fileUrl= req.body.fileUrl;
    res.status(200).send({"Url":fileUrl});
});


module.exports = router; 