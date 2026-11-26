
const mongoose = require("mongoose");

exports.connect = async () => {
  try {
    const url = process.env.MONGODB_URL;

    if (!url || !/^mongodb(\+srv)?:\/\//.test(url)) {
      throw new Error(
        "MONGODB_URL is missing or has an invalid format"
      );
    }

    await mongoose.connect(url);

    console.log("DB Connection Success");
  } catch (err) {
    console.error("DB Connection Failed:", err.message);
    process.exit(1);
  }
};
