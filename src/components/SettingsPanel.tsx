import React, { useState, useEffect } from "react";
import { X, Key, Save, AlertCircle, CheckCircle, LucideIcon, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { xaiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSave: (key: string, temperature: number, maxTokens: number) => void;
  temperature?: number;
  maxTokens?: number;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose, 
  apiKey, 
  onSave,
  temperature = 0.7,
  maxTokens = 8192
}) => {
  const [inputApiKey, setInputApiKey] = useState(apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [inputGetimgKey, setInputGetimgKey] = useState("");
  const [showGetimgKey, setShowGetimgKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [temperatureValue, setTemperatureValue] = useState(temperature);
  const [maxTokensValue, setMaxTokensValue] = useState(maxTokens);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [isTestingGetimgKey, setIsTestingGetimgKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();
  const { getimgApiKey, setGetimgApiKey } = useSettings();

  useEffect(() => {
    setInputApiKey(apiKey);
    setTemperatureValue(temperature);
    setMaxTokensValue(maxTokens);
    setInputGetimgKey(getimgApiKey || localStorage.getItem('getimgApiKey') || "");
  }, [apiKey, temperature, maxTokens]);

  const handleSave = () => {
    try {
      onSave(inputApiKey, temperatureValue, maxTokensValue);
      // Save Getimg key via context + localStorage
      setGetimgApiKey(inputGetimgKey || "");
      if (inputGetimgKey) {
        localStorage.setItem('getimgApiKey', inputGetimgKey);
      } else {
        localStorage.removeItem('getimgApiKey');
      }
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const testApiKey = async () => {
    if (!inputApiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter an API key to test.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingKey(true);
    try {
      console.log("Testing OpenRouter API key...");
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inputApiKey}`,
          'HTTP-Referer': window?.location?.origin || '',
          'X-Title': 'GrokTalk'
        },
        body: JSON.stringify({
          model: "x-ai/grok-3",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10
        })
      });
      
      if (response.ok) {
        toast({
          title: "API Key Valid",
          description: "Your OpenRouter API key is working correctly!",
        });
      } else {
        const error = await response.json();
        toast({
          title: "API Key Invalid",
          description: error.error?.message || "Your API key appears to be invalid.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not connect to the API server. Please check your internet connection.",
        variant: "destructive",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const StatusMessage = ({ status }: { status: typeof saveStatus }) => {
    if (status === "idle") return null;
    
    return (
      <div className={cn(
        "text-sm px-4 py-2 rounded-md mt-4",
        status === "success" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      )}>
        {status === "success" ? "Settings saved successfully!" : "Error saving settings"}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close settings"
              title="Close settings"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-6">
            {/* API Key Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                 OpenRouter API Key
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Your API key for accessing OpenRouter (Grok-3/4 and many other models). Required for all functionality.
              </p>
              <div className="flex relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  className="pr-10"
                  placeholder="Enter your OpenRouter API key..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Your API key is stored locally on your device.
                </div>
                
                <button
                  onClick={testApiKey}
                  disabled={isTestingKey}
                  className={cn(
                    "text-sm px-3 py-1 rounded-md flex items-center gap-1",
                    isTestingKey 
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" 
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  )}
                >
                  <Zap size={14} />
                  {isTestingKey ? "Testing..." : "Test API Key"}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                 Get your API key at <a 
                  href="https://openrouter.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  openrouter.ai
                </a>.
              </p>
            </div>

            {/* Getimg API Key Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                 Getimg API Key
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Used for image generation via FLUX.1 [schnell]. Only required for images.
              </p>
              <div className="flex relative">
                <Input
                  type={showGetimgKey ? "text" : "password"}
                  value={inputGetimgKey}
                  onChange={(e) => setInputGetimgKey(e.target.value)}
                  className="pr-10"
                  placeholder="Enter your Getimg API key..."
                />
                <button
                  type="button"
                  onClick={() => setShowGetimgKey(!showGetimgKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showGetimgKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Stored locally. Not sent anywhere except to Getimg when generating images.
                </div>
                
                <button
                  onClick={async () => {
                    if (!inputGetimgKey.trim()) {
                      toast({ title: "API Key Required", description: "Enter your Getimg API key to test.", variant: "destructive" });
                      return;
                    }
                    setIsTestingGetimgKey(true);
                    try {
                      const resp = await fetch('https://api.getimg.ai/v1/account/balance', {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${inputGetimgKey}`,
                        },
                      });
                      if (resp.ok) {
                        toast({ title: "Getimg Key Valid", description: "Balance retrieved successfully." });
                      } else {
                        const err = await resp.text();
                        toast({ title: "Getimg Key Invalid", description: err || 'Request failed', variant: "destructive" });
                      }
                    } catch (e) {
                      toast({ title: "Connection Error", description: "Could not reach Getimg API.", variant: "destructive" });
                    } finally {
                      setIsTestingGetimgKey(false);
                    }
                  }}
                  disabled={isTestingGetimgKey}
                  className={cn(
                    "text-sm px-3 py-1 rounded-md flex items-center gap-1",
                    isTestingGetimgKey 
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" 
                      : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                  )}
                >
                  <Zap size={14} />
                  {isTestingGetimgKey ? "Testing..." : "Test Getimg Key"}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                See the API docs for FLUX.1 [schnell] at <a
                  href="https://docs.getimg.ai/reference/postfluxschnelltexttoimage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  docs.getimg.ai
                </a>.
              </p>
            </div>
            
            {/* Advanced Settings */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ChevronsUpDown size={16} />
                <span>{showAdvanced ? "Hide" : "Show"} Advanced Settings</span>
              </button>
              
              {showAdvanced && (
                <div className="space-y-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                  {/* Temperature Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Temperature
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {temperatureValue.toFixed(1)}
                      </span>
                    </div>
                    <Slider 
                      value={[temperatureValue]} 
                      min={0} 
                      max={1} 
                      step={0.1} 
                      onValueChange={(value) => setTemperatureValue(value[0])}
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>0</span>
                      <span>1</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Higher values produce more varied outputs, lower values are more deterministic.
                    </p>
                  </div>
                  
                  {/* Max Tokens Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max Tokens
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {maxTokensValue}
                      </span>
                    </div>
                    <Slider 
                      value={[maxTokensValue]} 
                      min={1024} 
                      max={131072} 
                      step={1024} 
                      onValueChange={(value) => setMaxTokensValue(value[0])}
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>1K</span>
                      <span>128K</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Maximum length of the model's response. Higher values allow for longer responses.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <StatusMessage status={saveStatus} />
          </div>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 sticky bottom-0 bg-white dark:bg-gray-800">
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
