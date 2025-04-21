# PromptEd: Benchmarking AI Tutoring for Introductory Computer Science
#### Ahmed Ibrahim (ahmedei2), Yuanting Wang (yw101), Arif Demirtas (mad16), Laxmi Vijayan (laxmiv2)

## Abstract

Large Language Models (LLMs) are increasingly being used as educational tools by students, yet their effectiveness as intelligent tutoring systems remains underexplored. 
Prior research suggests that intelligent tutoring systems can significantly enhance learning outcomes, but concerns remain about students relying on AI for direct answers, rather than engaging in meaningful problem-solving. To address this, we propose PromptEd, a benchmark study for designing a system that enables multiple styles of tutoring, and evaluating how LLMs scaffold learning in introductory Computer Science (CS) education for students by recording tutoring data. 

First, we will conduct a literature review on how different teaching styles (e.g. direct answers, direct explanations, dialogue-enabling questions, and cognitive scaffolding) impact student interaction. Then, we will implement an AI-based chat interface that supports these modes of tutoring for students. AI-interactions will be recorded and a random subset of interactions will be analyzed based on engagement metrics and student understanding in pilot sessions by rating the interactions using a rubric. 

## New User System Features

The application now includes a user management system:
- User login (username-based authentication)
- User-specific LLM service access control
- User-specific default LLM service setting
- User-specific conversation history

## Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/prompted.git
cd prompted
```

2. Install dependencies:
```
npm run install:all
```

3. Configure the environment variables:
   - Copy `.env.example` to `.env` in both `/server` and `/client` directories
   - Configure your MongoDB connection string in `/server/.env`
   - Set your Gemini API key in `/server/.env`
   - Set session secrets and other configuration

4. Initialize the database with default users:
```
cd server
npm run init-db
```

This will create the following default users:
- `admin` (access to all LLM services)
- `student1` (access to dialogue and explanation LLM services)
- `student2` (access to direct and explanation LLM services)

## Running the Application

1. Start the development servers:
```
npm run dev
```

This will start both the client (React) and server (Express) applications.

2. The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## User Management

For admin users, you can add or modify users through the API:

```
POST /api/users
{
  "username": "new_user",
  "allowedServices": ["gemini-direct", "gemini-explanation"],
  "defaultService": "gemini-explanation"
}
```

## Available LLM Services

The following LLM services are available:
- `gemini-direct`: Direct answers without additional explanation
- `gemini-explanation`: Clear explanations with examples
- `gemini-dialogue`: Socratic dialogue with guiding questions
- `gemini-scaffolding`: Cognitive scaffolding that builds understanding

## Technologies Used

- Frontend: React, React Router, Axios
- Backend: Node.js, Express, MongoDB
- AI: Google Gemini API

## License

MIT
	