import { LLMRun, Message } from "@/types/logs";

export const messageContainsText = (message: Message, searchText: string): boolean => {
  return message.content?.toLowerCase().includes(searchText.toLowerCase()) ?? false;
};

export const runContainsText = (run: LLMRun, searchText: string): boolean => {
  return run.messages.some(msg => messageContainsText(msg, searchText)) || 
         run.response_texts.some(text => 
           text?.toLowerCase().includes(searchText.toLowerCase())
         );
}; 