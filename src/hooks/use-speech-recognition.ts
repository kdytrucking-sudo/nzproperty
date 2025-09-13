'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type SpeechRecognitionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: any) => void;
};

export const useSpeechRecognition = (options: SpeechRecognitionOptions = {}) => {
  const { lang = 'en-US', onResult, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript && onResult) {
          onResult(finalTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        if (onError) {
          onError(event.error);
        }
      };
      
      recognition.onend = () => {
          setIsListening(false);
      }

      recognitionRef.current = recognition;
    }
  }, [lang, onResult, onError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
          recognitionRef.current.start();
          setIsListening(true);
      } catch (error) {
          // May error if already started
          console.error("Could not start listening: ", error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
       try {
            recognitionRef.current.stop();
            setIsListening(false);
        } catch (error) {
             console.error("Could not stop listening: ", error);
        }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
};
