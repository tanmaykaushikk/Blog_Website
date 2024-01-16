const express = require("express");
const app = express();
// const path = require("path");

const mongoose = require("mongoose");
const User = require("./model/User.js");
const Blog = require("./model/Blog.js");
const session = require("express-session");
const nodemailer = require("nodemailer");
const exphbs = require("express-handlebars");
const bcrypt = require("bcrypt");

app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: false,
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    },
  })
);

app.set("view engine", "hbs");

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "sujalgupta1905@gmail.com", // Your Gmail email address
    pass: "egiy kmqc wary hbwd", // Your Gmail password
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "keyboard cat",
  })
);

// Function to generate a random verification token
function generateVerificationToken() {
  const tokenLength = 16;
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";

  for (let i = 0; i < tokenLength; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return token;
}

async function checkIsAdmin(req, res, next) {
  let isAdmin = false;
  const { username, email, password } = req.body;
  if (
    username == "admin" &&
    email == "sujalgupta1905@gmail.com" &&
    password == "admin123"
  ) {
    try {
      const hashAdminPass = await bcrypt.hash(password, 10); // Await the hash function
      const adminUser = new User({
        username: username,
        email: email,
        password: hashAdminPass,
      });
      await adminUser.save();
      await User.updateOne({ username: "admin" }, { $set: { isAdmin: true } });
      isAdmin = true;

      console.log("Admin logged in successfully");
    } catch (error) {
      console.error("Error hashing admin password:", error);
    }
  }
  req.isAdmin = isAdmin; // Store the value in req object for later use
  next();
}

app.get("/", async (req, res) => {
  try {
    const users = await User.find({}).populate("blog"); // Use "blog" field for populating
    res.render("home", {
      blogs: users.map((user) => user.blog).flat(), // Flatten the array of blogs
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.send("Internal Server Error");
  }
});

app.get("/login", checkIsAdmin, (req, res) => {
  res.render("login");
});

app.get("/register", checkIsAdmin, (req, res) => {
  res.render("register");
});

app.post("/register", checkIsAdmin, async (req, res) => {
  let isAdmin = req.isAdmin;

  if (isAdmin) {
    res.render("adminHome"); // Render adminHome template for admin
  } else {
    const { username, email, password } = req.body;

    // Generate a verification token
    const verificationToken = generateVerificationToken();

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: username,
      email: email,
      password: hashedPassword,
      verificationToken: verificationToken,
    });

    try {
      const saveUser = await newUser.save();

      if (saveUser) {
        // Send verification email
        const emailOptions = {
          from: "sujalgupta1905@gmail.com", // Your email address
          to: email,
          subject: "Account Verification",
          html: `<p>Please click the following link to verify your account: <a href="http://localhost:3334/verify?token=${verificationToken}">Verify</a></p>`,
        };

        await transporter.sendMail(emailOptions);
        console.log("Verification email sent");

        res.send("Check your email for verification");
      } else {
        res.send("Error");
      }
    } catch (error) {
      console.error("Error during registration:", error);
      res.send("Internal Server Error");
    }
  }
});

// Route to handle verification link
app.get("/verify", async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.send("Invalid verification link");
  }

  try {
    const user = await User.findOne({ verificationToken: token });

    if (user) {
      // Update user's verification status
      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();

      // Redirect to a success page or send a success message
      return res.send("User registered successfully, please login now");
    } else {
      return res.send("User not found");
    }
  } catch (error) {
    console.error("Error during verification:", error);
    return res.send("Internal Server Error");
  }
});

app.post("/login", checkIsAdmin, async (req, res) => {
  let isAdmin = req.isAdmin;

  if (isAdmin) {
    const users = await User.find({}).populate("blog"); // Use "blog" field for populating
    res.render("adminHome", {
      blogs: users.map((user) => user.blog).flat(), // Flatten the array of blogs
    });
  } else {
    const { username, email, password } = req.body;
    let user = await User.findOne({
      username: username,
      email: email,
    });

    if (user) {
      // Compare the provided password with the hashed password in the database
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (isPasswordMatch) {
        req.session.isLoggedIn = true;
        req.session.user = user;
        const users = await User.findById({
          _id: req.session.user._id,
        }).populate("blog");
        const userName = await User.findOne({ username: req.body.username });
        res.render("userHome", {
          user: userName,
          blogs: users.blog,
        });
      } else {
        res.send("Incorrect password");
      }
    } else {
      res.send("User not found");
    }
  }
});

app.get("/logout", async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const users = await User.find({}).populate("blog");
      res.render("home", {
        blogs: users.map((user) => user.blog).flat(),
      });
    } else {
      res.send("Forbidden");
    }
  } catch (error) {
    console.error("Error during logout:", error);
    res.send("Internal Server Error");
  }
});

app.get("/addBlog", (req, res) => {
  if (req.session.user && req.session.user._id) {
    res.render("addBlog");
  } else {
    res.redirect("/login"); // Redirect to login if the user is not logged in
  }
});

app.post("/addBlog", async (req, res) => {
  if (req.session.user && req.session.user._id) {
    const { title, content } = req.body;
    let newBlog = new Blog({
      title: title,
      content: content,
      user: req.session.user._id,
    });
    await newBlog.save();

    let user = await User.findOne({ _id: req.session.user._id });
    user.blog.push(newBlog._id);
    user.save();
    res.send("Blog added");
  } else {
    res.redirect("/login"); // Redirect to login if the user is not logged in
  }
});

app.get("/myBlog", async (req, res) => {
  if (req.session.user && req.session.user._id) {
    try {
      let user = await User.findOne({ _id: req.session.user._id }).populate(
        "blog"
      );
      console.log(user);
      res.render("myBlog", {
        user: user,
        blogs: user.blog,
      });
    } catch (error) {
      console.error("Error fetching user blogs:", error);
      res.send("Internal Server Error");
    }
  } else {
    res.redirect("/login"); // Redirect to login if user is not logged in
  }
});

app.post("/approval", async (req, res) => {
  const blogId = req.body.blogId;
  const isApproved = req.body.hasOwnProperty("approve");
  const isRejected = req.body.hasOwnProperty("reject");

  try {
    if (isApproved) {
      await Blog.updateOne({ _id: blogId }, { $set: { isApproved: true } });
    } else if (isRejected) {
      await Blog.deleteOne({ _id: blogId });
    }

    // Fetch only the blogs that haven't been approved or rejected
    const blogs = await Blog.find({ isApproved: { $exists: false } });

    // Render the adminHome page with the filtered blogs
    res.render("adminHome", { blogs: blogs });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.send("Internal Server Error");
  }
});

app.get("/adminHome", async (req, res) => {
  try {
    const blogs = await Blog.find({ isApproved: { $ne: true, $ne: false } });
    res.render("adminHome", { blogs: blogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.send("Internal Server Error");
  }
});

app.get("/userHome", async (req, res) => {
  if (req.session.user && req.session.user._id) {
    try {
      let user = await User.findOne({ _id: req.session.user._id }).populate(
        "blog"
      );
      console.log(user);
      res.render("userHome", {
        user: user,
        blogs: user.blog,
      });
    } catch (error) {
      console.error("Error fetching user blogs:", error);
      res.send("Internal Server Error");
    }
  } else {
    res.redirect("/login"); // Redirect to login if the user is not logged in
  }
});

mongoose.connect("mongodb://127.0.0.1:27017/blogDB").then(() => {
  app.listen(3334, () => {
    console.log("Server started");
  });
});
