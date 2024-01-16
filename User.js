const mongoose = require("mongoose");
const { Schema } = mongoose;

let userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  blog: [
    {
      type: Schema.Types.ObjectId,
      ref: "Blog",
    },
  ],
  isAdmin: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("User", userSchema);
