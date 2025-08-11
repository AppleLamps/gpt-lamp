import React, { useState, FormEvent, useRef, useEffect } from "react";
import { Send, Plus, X, Image as ImageIcon, Paperclip, ChevronDown, ChevronUp, Camera, Sparkles, ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import FileUploader, { ProcessedFile } from "./FileUploader";
import { useToast } from "@/hooks/use-toast";
import { xaiService } from "@/services/api";
import { useSettings } from "@/contexts/SettingsContext";
import { useChatContext } from "@/contexts/ChatContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to generate IDs
const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}-${randomStr}`;
};

interface ChatInputProps {
  onSendMessage: (
    message: string, 
    images: string[], 
    files: ProcessedFile[], 
    isBotGenerated?: boolean, 
    isImageRequest?: boolean,
    messageId?: string,
    isGeneratingImage?: boolean,
    imagePrompt?: string
  ) => void;
  onUpdateMessageWithImage?: (messageId: string, text: string, imageUrl: string) => void;
  isProcessing: boolean;
}

const ChatInput = ({ 
  onSendMessage, 
  onUpdateMessageWithImage,
  isProcessing 
}: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<{file: File, preview: string}[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [imageGenerationMode, setImageGenerationMode] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentModel, setCurrentModel } = useSettings();
  const { isWebEnabled, toggleWebSearch } = useChatContext();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isProcessing || (!input.trim() && selectedImages.length === 0 && processedFiles.length === 0)) return;
    
    const trimmedInput = input.trim();
    
    // Check if we should use image generation mode
    // This includes explicit mode or natural language requests for image generation
    const isImageGenerationRequest = (text: string): boolean => {
      if (imageGenerationMode) return true;
      
      const generationKeywords = [
        "generate an image",
        "create an image",
        "show me an image",
        "make an image",
        "can you generate an image",
        "could you create an image",
        "can you make an image",
        "draw",
        "generate a picture",
        "create a picture",
        "make a picture",
        "show a picture",
        "create a photo",
        "generate a photo",
        "make a photo of",
        "show me a photo of",
        "generate an illustration",
        "create an illustration",
        "illustrate",
        "render an image",
        "visualize"
      ];
      
      return generationKeywords.some(keyword => 
        text.toLowerCase().includes(keyword)
      );
    };
    
    const shouldGenerateImage = isImageGenerationRequest(trimmedInput);
    
    // Clear the input field and selected files
    setInput("");
    
    // Turn off image generation mode after submitting
    setImageGenerationMode(false);
    
    if (shouldGenerateImage) {
      // Start image generation directly with the new single-message flow
      generateImage(trimmedInput);
      return;
    }
    
    // Create an array of image data URLs from selectedImages
    const imageDataUrls = selectedImages.map(img => img.preview);
    
    // Send the message with images and/or files
    onSendMessage(trimmedInput, imageDataUrls, processedFiles);

    // Close the file uploader if files were attached
    if (processedFiles.length > 0) {
      setShowFileUploader(false);
    }

    // Clear selected images and files after sending
    setSelectedImages([]);
    setProcessedFiles([]);
  };

  // Function to enhance prompts using AI
  const enhancePromptWithAI = async (originalPrompt: string): Promise<string> => {
    try {
      // Get the API key from localStorage
      const apiKey = localStorage.getItem('apiKey');
      
      if (!apiKey) {
        throw new Error("API key is missing");
      }
      
      // Show toast indicating prompt enhancement
      toast({
        title: "Enhancing your prompt...",
        description: "Using AI to improve your image request",
      });
      
      // Create messages array for the API
      const messages = [
        {
          role: "system",
          content: "You are an expert prompt engineer for image generation. Your job is to enhance user prompts to create better images. Add details about lighting, composition, style, mood, and colors. Keep the enhanced prompt under 200 characters. Only respond with the enhanced prompt text, nothing else."
        },
        {
          role: "user",
          content: `Enhance this image generation prompt: "${originalPrompt}"`
        }
      ];
      
      // Call the API to enhance the prompt via OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window?.location?.origin || '',
          'X-Title': 'LampsGPT'
        },
        body: JSON.stringify({
          model: "x-ai/grok-3",
          messages: messages,
          temperature: 0.7,
          max_tokens: 150
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Prompt enhancement failed:", errorData);
        return originalPrompt; // Fall back to original prompt
      }
      
      const data = await response.json();
      let enhancedPrompt = data.choices[0].message.content.trim();
      
      // Sometimes the model might include quotes, remove them
      enhancedPrompt = enhancedPrompt.replace(/^["'](.*)["']$/, '$1');
      
      console.log(`Original prompt: "${originalPrompt}"`);
      console.log(`Enhanced prompt: "${enhancedPrompt}"`);
      
      return enhancedPrompt;
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      return originalPrompt; // Fall back to original prompt on error
    }
  };

  // Function to handle image generation via Getimg FLUX.1 [schnell]
  const generateImage = async (prompt: string) => {
    try {
      const openRouterApiKey = localStorage.getItem('apiKey');
      const getimgApiKey = localStorage.getItem('getimgApiKey');
      if (!openRouterApiKey) {
        throw new Error("API key is missing. Please set your OpenRouter API key in the settings.");
      }
      if (!getimgApiKey) {
        throw new Error("Getimg API key is missing. Please set it in Settings under Getimg API Key.");
      }
      
      // First, add the user's message to the chat
      onSendMessage(prompt, [], [], false, true);
      
      // Create a message with placeholder immediately
      const messageId = generateId('assistant-');
      
      // Create and send placeholder message with minimal text content (assistant)
      onSendMessage("Generating image...", [], [], true, false, messageId, true, prompt);
      
      // Enhance the prompt using AI (OpenRouter text model)
      const enhancedPrompt = await enhancePromptWithAI(prompt);

      // Call Getimg with minimal body per docs: expect top-level { url }
      const response = await fetch('https://api.getimg.ai/v1/flux-schnell/text-to-image', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getimgApiKey}`,
        },
        body: JSON.stringify({
          prompt: enhancedPrompt
        })
      });

      if (!response.ok) {
        let errMsg = `API error: ${response.status}`;
        try {
          const errBody = await response.json();
          const message = typeof errBody?.error === 'string' ? errBody.error : JSON.stringify(errBody?.error || errBody);
          errMsg += ` - ${message}`;
        } catch {
          try {
            const text = await response.text();
            errMsg += ` - ${text}`;
          } catch {}
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      // Accept multiple response shapes from Getimg
      let imageUrl: string | null = null;
      try {
        if (typeof data?.url === 'string' && data.url) {
          imageUrl = data.url;
        } else if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          const first = data.data[0];
          if (first.url) {
            imageUrl = String(first.url);
          } else if (first.b64_json) {
            imageUrl = `data:image/png;base64,${first.b64_json}`;
          } else if (first.base64 || first.base64Image || first.image) {
            const b64 = first.base64 || first.base64Image || first.image;
            imageUrl = `data:image/png;base64,${b64}`;
          }
        } else if (Array.isArray(data?.output) && data.output.length > 0) {
          // Some endpoints return output: [url | base64]
          const first = data.output[0];
          if (typeof first === 'string' && first.startsWith('http')) {
            imageUrl = first;
          } else if (typeof first === 'string') {
            imageUrl = first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
          }
        } else if (Array.isArray(data?.images) && data.images.length > 0) {
          const first = data.images[0];
          if (typeof first === 'string' && first.startsWith('http')) {
            imageUrl = first;
          } else if (typeof first === 'string') {
            imageUrl = first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
          }
        } else if (typeof data?.image === 'string') {
          const v = data.image;
          imageUrl = v.startsWith('data:') ? v : `data:image/png;base64,${v}`;
        }
      } catch (parseErr) {
        console.warn('Unexpected Getimg response format', parseErr, data);
      }

      if (imageUrl) {
        
        // Update the existing message with the generated image
        if (onUpdateMessageWithImage) {
          onUpdateMessageWithImage(messageId, `Generated image for you:`, imageUrl);
        } else {
          // Don't create a new message, just log an error
          console.error("Update message function not available");
        }
      } else {
        console.error('Getimg response body (unparsed):', data);
        throw new Error('No image data returned from Getimg');
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      toast({
        title: "Image Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate image.",
        variant: "destructive",
      });
    }
  };

  const toggleImageGenerationMode = () => {
    setImageGenerationMode(!imageGenerationMode);
    if (!imageGenerationMode) {
      toast({
        title: "Image Generation Mode",
        description: "Your next message will be processed as an image generation prompt.",
      });
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    if (selectedImages.length + files.length > 4) {
      alert("You can only upload up to 4 images.");
      return;
    }
    
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MiB
      
      if (!isValidType) {
        alert(`File "${file.name}" has an invalid format. Supported: JPG/JPEG, PNG, WEBP, GIF.`);
      }
      if (!isValidSize) {
        alert(`File "${file.name}" exceeds the maximum size of 10MiB.`);
      }
      
      return isValidType && isValidSize;
    });
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [
          ...prev,
          {
            file,
            preview: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleImageButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFilesProcessed = (files: ProcessedFile[]) => {
    setProcessedFiles(prev => {
      const existingFileNames = new Set(prev.map(file => file.name));
      const newFiles = files.filter(file => !existingFileNames.has(file.name));
      
      const totalSize = [...prev, ...newFiles].reduce((acc, file) => acc + file.size, 0);
      
      if (totalSize > 50 * 1024 * 1024) {
        alert("Total file size exceeds the 50MB limit. Some files were not added.");
        
        const currentSize = prev.reduce((acc, file) => acc + file.size, 0);
        const remainingSize = 50 * 1024 * 1024 - currentSize;
        
        const sortedFiles = [...newFiles].sort((a, b) => a.size - b.size);
        const filesToAdd = [];
        let runningSize = 0;
        
        for (const file of sortedFiles) {
          if (runningSize + file.size <= remainingSize) {
            filesToAdd.push(file);
            runningSize += file.size;
          }
        }
        
        return [...prev, ...filesToAdd];
      }
      
      return [...prev, ...newFiles];
    });
  };
  
  const toggleFileUploader = () => {
    setShowFileUploader(prev => !prev);
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <form 
        onSubmit={handleSubmit}
        className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow overflow-hidden"
      >
        <div className="flex flex-col">
          {showFileUploader && (
            <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-600">
              <FileUploader 
                onFileProcess={handleFilesProcessed} 
                disabled={isProcessing}
                maxFiles={3}
              />
            </div>
          )}
          
          {selectedImages.length > 0 && (
            <div className="px-3 pt-3 flex flex-wrap gap-2">
              {selectedImages.map((img, index) => (
                <div key={index} className="relative">
                  <img 
                    src={img.preview} 
                    alt={`Preview ${index}`} 
                    className="w-16 h-16 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-gray-800 dark:bg-gray-600 text-white rounded-full p-0.5"
                    aria-label="Remove image"
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {processedFiles.length > 0 && (
            <div className="px-3 pt-3">
              <div className="flex items-center p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-md">
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  <span className="font-medium">{processedFiles.length} file{processedFiles.length !== 1 ? 's' : ''}</span> attached
                  
                  {processedFiles.some(file => file.name.toLowerCase().endsWith('.pdf')) && (
                    <span className="block text-xs mt-1">
                      Note: PDF text extraction may be limited. For best results, ask specific questions about the content.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="px-3 pt-3 pb-2 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageGenerationMode
                  ? "Describe the image you want to generate..."
                  : processedFiles.length > 0 
                      ? "Ask a question about the attached file(s)..." 
                      : "Message assistant..."
              }
              disabled={isProcessing}
              className={cn(
                "w-full resize-none py-1 px-0 max-h-[200px] min-h-[24px]",
                "bg-transparent border-0 focus:ring-0 focus:outline-none text-base",
                "text-gray-700 dark:text-gray-200",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                isProcessing && "opacity-70"
              )}
              rows={1}
            />
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-600 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
                aria-label="Upload images"
                title="Upload images"
              />
              <button 
                type="button"
                onClick={handleImageButtonClick}
                disabled={selectedImages.length >= 4 || isProcessing || imageGenerationMode}
                className={cn(
                  "p-1.5 rounded-md",
                  "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-600",
                  (selectedImages.length >= 4 || isProcessing || imageGenerationMode) && "opacity-50 cursor-not-allowed"
                )}
                title={selectedImages.length >= 4 ? "Maximum of 4 images allowed" : "Add images"}
              >
                <ImageIcon size={16} />
              </button>
              
              <button
                type="button"
                onClick={toggleImageGenerationMode}
                disabled={isProcessing}
                className={cn(
                  "p-1.5 rounded-md",
                  "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-600",
                  imageGenerationMode && "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
                title="Toggle image generation mode"
              >
                <Camera size={16} />
              </button>
              
              <button
                type="button"
                onClick={toggleFileUploader}
                disabled={isProcessing || imageGenerationMode}
                className={cn(
                  "p-1.5 rounded-md flex items-center gap-1",
                  "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-600",
                  showFileUploader && "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200",
                  (isProcessing || imageGenerationMode) && "opacity-50 cursor-not-allowed"
                )}
                title="Attach files (PDF, TXT, CSV, etc.)"
              >
                <Paperclip size={16} />
                {showFileUploader ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                type="button"
                onClick={toggleWebSearch}
                disabled={isProcessing}
                className={cn(
                  "p-1.5 rounded-md",
                  "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-600",
                  isWebEnabled && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
                title="Toggle web search"
              >
                <Search size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {!imageGenerationMode && (
                <div className="flex items-center gap-2">
                  <Select
                    value={currentModel}
                    onValueChange={(value) => {
                      setCurrentModel(value);
                      try { localStorage.setItem('currentModel', value); } catch {}
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 px-2 rounded-md border border-gray-200 dark:border-gray-700",
                        "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200",
                        "hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                      aria-label="Select model"
                      title="Select model"
                      disabled={isProcessing}
                    >
                      <div className="flex items-center gap-1">
                        <Sparkles size={14} className="text-green-500" />
                        <SelectValue placeholder="Select model" />
                      </div>
                    </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="x-ai/grok-3">Grok‑3</SelectItem>
                      <SelectItem value="x-ai/grok-4">Grok‑4</SelectItem>
                       <SelectItem value="z-ai/glm-4.5">GLM 4.5</SelectItem>
                       <SelectItem value="z-ai/glm-4.5v">GLM 4.5V (Vision)</SelectItem>
                       <SelectItem value="z-ai/glm-4.5-air:free">GLM 4.5 Air (free)</SelectItem>
                      <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                      <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="cognitivecomputations/dolphin-mistral-24b-venice-edition:free">Venice Uncensored</SelectItem>
                       <SelectItem value="openai/gpt-4o-2024-11-20">GPT‑4o (2024‑11‑20)</SelectItem>
                       <SelectItem value="openai/gpt-4.1">GPT‑4.1</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT‑5 (thinking)</SelectItem>
                      <SelectItem value="openai/gpt-5-chat">GPT‑5</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">GPT‑5 Mini</SelectItem>
                      <SelectItem value="anthropic/claude-opus-4.1">Claude Opus 4.1</SelectItem>
                      <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                      <SelectItem value="ai21/jamba-large-1.7">Jamba Large 1.7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <button
                type="submit"
                disabled={(!input.trim() && selectedImages.length === 0 && processedFiles.length === 0) || isProcessing}
                className={cn(
                  "p-2 rounded-full transition-all duration-200 ml-2 shadow-sm",
                  (input.trim() || selectedImages.length > 0 || processedFiles.length > 0) && !isProcessing 
                    ? imageGenerationMode
                      ? "bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md transform hover:scale-105"
                      : "bg-green-600 text-white hover:bg-green-700 hover:shadow-md transform hover:scale-105" 
                    : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 opacity-50 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <ArrowUp size={16} className="transition-transform duration-200" />
              </button>
            </div>
          </div>
        </div>
      </form>
      
      {isProcessing && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-75"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-150"></div>
          <span className="ml-1">
            {imageGenerationMode 
              ? "Generating image..." 
              : "Thinking..."}
          </span>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
