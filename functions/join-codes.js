const crypto = require("crypto");

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(length) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return out;
}

function generateJoinCode(options = {}) {
  const segments = options.segments ?? 3;
  const segmentLength = options.segmentLength ?? 4;
  return Array.from({ length: segments }, () => randomToken(segmentLength)).join("-");
}

module.exports = {
  generateJoinCode,
  sha256,
};
