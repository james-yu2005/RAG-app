import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { retriever } from "./utils/retriever.js";
import { combineDocuments } from "./utils/combineDocuments.js";
import { formatConvHistory } from "./utils/convHistory.js";
import dotenv from 'dotenv';
dotenv.config();

const openAIApiKey = process.env.OPENAI_API_KEY;

if (!openAIApiKey) {
    console.error("Missing OpenAI API key. Please set OPENAI_API_KEY in your .env file.");
    process.exit(1);
}

const llm = new ChatOpenAI({ openAIApiKey });

let conv_History = [
    'Hi my name is Bob! Who are the teachers for scrimba?',
    'The teachers for Scrimba include code reviewers, professional developers, and Scrimba teachers.'
];

const question_asked_by_user = "Whats my name?";

const standaloneQuestionTemplate = `Please simplify this question into a standalone and use conversation history if it exists
conversation history: {conversation_History}
question: {question}
standalone question:`;
const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
const standaloneQuestionChain = RunnableSequence.from([
    standaloneQuestionPrompt,
    llm, 
    new StringOutputParser(),
]);

const retrieverChain = RunnableSequence.from([
    prevResult => prevResult.standalone_question,
    retriever,
    combineDocuments
]);

const answerTemplate = `You are a helpful and enthusiastic support bot. Don't say the answer if you don't know it. Answer the question given
some context. If you can't properly use the context, look at the conversation history. The original prompt from the user is also given.
context: {context} 
conversation history: {conversation_History}
prompt: {prompt}  
answer:`;
const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
const answerChain = RunnableSequence.from([
    answerPrompt,
    llm,
    new StringOutputParser(),
]);

const chain = RunnableSequence.from([
    {
        standalone_question: standaloneQuestionChain,
        original_input: new RunnablePassthrough(),
    },
    {
        context: retrieverChain,
        prompt: ({ original_input }) => original_input.question,
        conversation_History: ({ original_input }) => original_input.conversation_History,
    },
    answerChain
]);

try {
    const response = await chain.invoke({
        question: question_asked_by_user,
        conversation_History: formatConvHistory(conv_History),
    });

    console.log("Response received:", response);
    conv_History.push(question_asked_by_user);
    conv_History.push(response);
    console.log(conv_History);
} catch (error) {
    console.error("Error occurred while invoking the chain:", error);
}
