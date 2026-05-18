const fs = require("fs");

// 👉 tự sửa đường dẫn ở đây
const filePath = "./public/data/600WORDS.json";

try {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!Array.isArray(data)) {
    throw new Error("JSON phải là array!");
  }

  console.log(data.length);

} catch (err) {
  console.error(err.message);
}