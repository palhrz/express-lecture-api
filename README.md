# Lecture Management API

Backend API for the Lecture Management System, built with **Node.js** and **Express**.

## Features
+ Auto-generate Google Form Link via App Script
- Sentiment analysis and keyword extraction

## Installation
```bash
# Clone the repository
git clone https://github.com/palhrz/express-lecture-api.git

# Navigate into the project
cd lecture-api

# Install dependencies
npm install
```

## Configuration
1. Create a `.env` file in the root directory and set the required variables:
```
PORT=4000
APP_SCRIPT_URL=
```

2. Place your Firebase service account key file in the root directory as `serviceAccountKey.json`  
   *(Make sure to add it to `.gitignore` so it is not committed to version control.)*

## Running the Server
```bash
# Start server
npm start
```