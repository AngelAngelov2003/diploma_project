const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});

const imageOnly = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }

  cb(new Error("Only image uploads are allowed"));
};

const upload = multer({ storage });

const claimUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const lakePhotoUpload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = {
  uploadDir,
  storage,
  upload,
  claimUpload,
  lakePhotoUpload,
};
