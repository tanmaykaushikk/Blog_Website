const mongoose = require("mongoose");
const { Schema } = mongoose;

const blogSchema = new mongoose.Schema({
  title: String,
  content: String,
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  isApproved: Boolean,
});

module.exports = mongoose.model("Blog", blogSchema);
