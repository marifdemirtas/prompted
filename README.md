# PromptEd: Benchmarking AI Tutoring for Introductory Computer Science
#### Ahmed Ibrahim (ahmedei2), Yuanting Wang (yw101), Arif Demirtas (mad16), Laxmi Vijayan (laxmiv2)

## Abstract

Large Language Models (LLMs) are increasingly being used as educational tools by students, yet their effectiveness as intelligent tutoring systems remains underexplored. 
Prior research suggests that intelligent tutoring systems can significantly enhance learning outcomes, but concerns remain about students relying on AI for direct answers, rather than engaging in meaningful problem-solving. To address this, we propose PromptEd, a benchmark study for designing a system that enables multiple styles of tutoring, and evaluating how LLMs scaffold learning in introductory Computer Science (CS) education for students by recording tutoring data. 

First, we will conduct a literature review on how different teaching styles (e.g. direct answers, direct explanations, dialogue-enabling questions, and cognitive scaffolding) impact student interaction. Then, we will implement an AI-based chat interface that supports these modes of tutoring for students. AI-interactions will be recorded and a random subset of interactions will be analyzed based on engagement metrics and student understanding in pilot sessions by rating the interactions using a rubric. 

## Prerequisites
- Node.js (v16+)
- npm or yarn
- MongoDB (local or Atlas)
- Google Generative AI API key (for Gemini models)

## Installation

See [SETUP.md](SETUP.md) for detailed installation instructions.

## Project Structure

- `/client` - React frontend application
- `/server` - Node.js/Express backend API
- `/server/models` - MongoDB schemas
- `/server/controllers` - API route controllers
- `/server/services` - LLM integration services
	