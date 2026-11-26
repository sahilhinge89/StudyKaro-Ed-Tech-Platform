# StudyKaro 

StudyKaro is a full-stack ed-tech platform where instructors create and sell video courses and students browse, buy and learn from them.

## Features

- **Authentication**: sign up with email OTP verification, login (JWT), forgot / reset password
- **Roles**: Student, Instructor and Admin
- **Instructors**
  - Create, edit and publish courses (sections and video lectures)
  - Create new course categories directly from the Add Course form (duplicates are blocked)
  - Instructor dashboard with course stats
- **Students**
  - Browse courses by category in the catalog
  - Cart and checkout with Razorpay (cards, UPI, netbanking)
  - Enrolled courses with lecture progress tracking
  - Course ratings and reviews
- **Profile and settings**: update profile, change profile picture, change password, delete account
- **Contact form** with email notification

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React (Create React App), Redux Toolkit, React Router, Tailwind CSS, react-hook-form, react-dropzone |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Media storage | Cloudinary |
| Payments | Razorpay |
| Email | Nodemailer |

## Prerequisites

Install or create these before you start:

- **Node.js 16 or later** (the project's `.nvmrc` pins `v16.18.0`) and npm
- **Git**
- A **MongoDB** database (a free MongoDB Atlas cluster works)
- A **Cloudinary** account (for thumbnails and lecture videos)
- A **Razorpay** account in **Test Mode** (for payments)
- An email account for sending OTP and notification emails (for Gmail, use an [App Password](https://support.google.com/accounts/answer/185833))

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/sahilhinge89/StudyKaro-.git
cd StudyKaro-
```

### 2. Install dependencies

Install the frontend packages from the project root, then the backend packages:

```bash
npm install
cd server
npm install
cd ..
```

### 3. Set up environment variables

Create **two** `.env` files. Neither is committed to Git (both are in `.gitignore`), so every developer creates their own.

**Frontend: `.env` in the project root**

```env
REACT_APP_BASE_URL=http://localhost:4000/api/v1
REACT_APP_RAZORPAY_KEY=rzp_test_xxxxxxxxxxxx
```

**Backend: `server/.env`**

```env
PORT=4000

# MongoDB connection string
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studykaro

# Secret used to sign login tokens (use a long random string)
JWT_SECRET=change-this-to-a-long-random-string

# Email (OTP and notifications)
MAIL_HOST=smtp.gmail.com
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# Cloudinary
CLOUD_NAME=your-cloud-name
API_KEY=your-cloudinary-api-key
API_SECRET=your-cloudinary-api-secret
FOLDER_NAME=StudyKaro

# Razorpay (Test Mode keys)
RAZORPAY_KEY=rzp_test_xxxxxxxxxxxx
RAZORPAY_SECRET=your-razorpay-key-secret
```

Notes:

- `REACT_APP_RAZORPAY_KEY` and `RAZORPAY_KEY` are the same **Key ID**. The **Key Secret** goes only in `server/.env`, never in the frontend.
- Create React App only exposes variables that start with `REACT_APP_` to the browser.
- Restart both servers after changing any `.env` file.

### 4. Run the app

Run the frontend and backend together from the project root:

```bash
npm run dev
```

Or run them in two separate terminals:

```bash
# Terminal 1: backend (http://localhost:4000)
cd server
npm run dev

# Terminal 2: frontend (http://localhost:3000)
npm start
```

Open **http://localhost:3000** in your browser. Opening http://localhost:4000 should show `Your server is up and running ...`.

## First-time setup

1. **Create an instructor account.** On the Sign Up page, choose **Instructor**. Email OTP verification must work, so check your `MAIL_*` settings.
2. **Add a category.** Log in as the instructor, open **Dashboard, Add Course**, and use **"Create a new one"** under the category dropdown.
3. **Create and publish a course.** Only **Published** courses appear in the catalog.
4. **Test a purchase.** Sign up a second account as a **Student**, add the course to the cart and check out. In Razorpay Test Mode, use Razorpay's test card or UPI details (see the [Razorpay test docs](https://razorpay.com/docs/payments/payments/test-card-upi-details/)).

### Optional: admin account

Category creation is open to instructors. If you want an admin user, create a normal account and change its `accountType` to `Admin` in the `users` collection in MongoDB.

## Project structure

```
StudyKaro/
├── public/                  Static files and HTML template
├── src/                     React frontend
│   ├── components/          Reusable and feature components
│   ├── pages/               Route pages (Home, Catalog, Dashboard, ...)
│   ├── services/            API calls (apis.js, operations/)
│   ├── slices/              Redux state
│   └── utils/ , data/ , hooks/
├── server/                  Express backend
│   ├── config/              Database, Cloudinary, Razorpay setup
│   ├── controllers/         Request handlers
│   ├── middleware/          Auth and role checks
│   ├── models/              Mongoose schemas
│   ├── routes/              API routes
│   ├── mail/ , utils/       Email templates and helpers
│   └── index.js             Server entry point
├── package.json             Frontend dependencies and scripts
└── README.md
```

## Scripts

| Command | Where | What it does |
|---|---|---|
| `npm run dev` | root | Runs frontend and backend together |
| `npm start` | root | Starts the React dev server (port 3000) |
| `npm run build` | root | Creates a production build of the frontend |
| `npm run dev` | `server/` | Starts the backend with nodemon (auto-restart) |
| `npm start` | `server/` | Starts the backend with node |

## Troubleshooting

| Problem | Fix |
|---|---|
| "Authentication key was missing" at checkout | Add `REACT_APP_RAZORPAY_KEY` to the root `.env` and restart the frontend |
| Video upload fails with `413` | The file is too big for Cloudinary's plan limit (about 100 MB on the free plan). Compress the video first (for example with HandBrake) |
| Thumbnail box does nothing when clicked | Make sure `<input {...getInputProps()} />` in `Upload.jsx` has no extra `ref` |
| Catalog page shows 404 | The category has no **Published** course yet. Publish a course in that category |
| Changes to `.env` have no effect | Stop and restart both servers |
| `DB Connection Failed` | Check `MONGODB_URL`, and that your IP is allowed in MongoDB Atlas (Network Access) |

## Security

- Never commit `.env` files or real keys.
- If a secret was ever pushed to GitHub, rotate it (Razorpay secret, Cloudinary secret, JWT secret, database password).
- Use Razorpay **Test Mode** keys during development.
