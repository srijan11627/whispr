// JWT helpers + Express auth middleware
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "whispr-dev-secret-change-me";

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "30d" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Socket.io auth — token comes via handshake auth payload
function socketAuth(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error("Missing token"));
  try {
    socket.user = jwt.verify(token, SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}

module.exports = { signToken, authMiddleware, socketAuth, SECRET };
