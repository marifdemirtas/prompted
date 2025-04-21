# PromptEd Setup Guide

This guide will help you set up the PromptEd application for local development.

## Prerequisites

Before you begin, make sure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v16 or newer)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [MongoDB](https://www.mongodb.com/try/download/community) (local installation or MongoDB Atlas account)
- [Git](https://git-scm.com/)
- A Google Generative AI API key (for Gemini models)

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/prompted.git
cd prompted
```

## Step 2: Set Up Environment Variables

Create the necessary environment files:

### For the server:

1. Copy the example environment file:
```bash
cp server/.env.example server/.env
```

2. Edit `server/.env` to add your MongoDB URI and Gemini API key:
```
PORT=8000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/prompted
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-lite
```

You can get your Gemini API key from the Google AI Studio (free tier available): https://aistudio.google.com/apikey
You can get your MongoDB URI from MongoDB Atlas (free tier available): https://cloud.mongodb.com/

### For the client:

1. Copy the example environment file:
```bash
cp client/.env.example client/.env
```

2. Edit `client/.env` if needed (defaults should work for local development):
```
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_ENV=development
```

## Step 3: Install Dependencies

Install all dependencies at once using the root package.json:

```bash
npm run install:all
```

Or install them separately:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Return to root directory
cd ..
```

## Step 4: Start MongoDB (if using local MongoDB)

Make sure your MongoDB server is running locally. If you're using MongoDB Atlas, this step is not needed.

## Step 5: Run the Application (Deployment and Prompting)

Make sure the client app is built:

```bash
cd client
npm run build
```

From the root directory, run:

```bash
cd server
npm start
```

- The app will run on http://localhost:8000.


## Step 5: Run the Application (Frontend Development)

From the root directory, run:

```bash
npm start
```

This will start both the server and client concurrently:
- The server will run on http://localhost:8000
- The client will run on http://localhost:3000

## Troubleshooting

If you encounter any issues with the setup:

1. Check that MongoDB is running properly
2. Ensure your Gemini API key is valid
3. Make sure all environment variables are set correctly
4. Check the terminal for any error messages
5. If you see dependency errors related to Gemini, make sure you have installed the Google Generative AI package:
   ```bash
   cd server
   npm install @google/generative-ai
   ```

## Project Structure

- `/client` - React frontend application
- `/server` - Node.js/Express backend API
- `/server/models` - MongoDB schemas
- `/server/controllers` - API route controllers
- `/server/services` - LLM integration services

## Additional Configuration

### Using a Different LLM Provider

To use a different LLM provider than Gemini, modify the `server/services/llmService.js` file to integrate with your preferred API. 