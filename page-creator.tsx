"use client"

import { useState, useRef } from "react"
import { Mic, Square, Download, Play, Pause, AlertCircle } from "lucide-react"

interface AudioRecording {
  id: string
  url: string
  blob: Blob
  timestamp: Date
  transcription?: string
}

export default function Component() {
  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [recordings, setRecordings] = useState<AudioRecording[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const startRecording = async () => {
    try {
      setTranscriptionError(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasPermission(true)

      audioChunksRef.current = []

      // Use WebM format for better compatibility
      let mimeType = "audio/webm"
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus"
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true)

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(audioBlob)

        const newRecording: AudioRecording = {
          id: Date.now().toString(),
          url,
          blob: audioBlob,
          timestamp: new Date(),
        }

        setRecordings((prev) => [...prev, newRecording])
        setIsProcessing(false)

        stream.getTracks().forEach((track) => track.stop())

        // Start transcription
        await transcribeAudio(audioBlob, mimeType, newRecording.id)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error: any) {
      console.error("Recording error:", error)
      setHasPermission(false)
    }
  }

  const transcribeAudio = async (blob: Blob, mimeType: string, recordingId: string) => {
    setIsTranscribing(true)
    setTranscriptionError(null)

    try {
      const apiEndpoint = "/api/transcribe"

      const formData = new FormData()
      const audioFile = new File([blob], "recording.webm", { type: mimeType })
      formData.append("audio", audioFile)

      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (result.text) {
        // Update the recording with transcription
        setRecordings((prev) =>
          prev.map((recording) =>
            recording.id === recordingId ? { ...recording, transcription: result.text } : recording,
          ),
        )

        // Add transcription to textarea
        if (textareaRef.current) {
          const currentText = textareaRef.current.value
          const newText = currentText ? `${currentText} ${result.text}` : result.text
          textareaRef.current.value = newText
          textareaRef.current.focus()
        }
      } else {
        throw new Error("No transcription text received")
      }
    } catch (error: any) {
      console.error("Transcription error:", error)
      setTranscriptionError(error.message)
    } finally {
      setIsTranscribing(false)
    }
  }

  const retryTranscription = (recording: AudioRecording) => {
    const mimeType = recording.blob.type || "audio/webm"
    transcribeAudio(recording.blob, mimeType, recording.id)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const togglePlayback = (recordingId: string) => {
    const audioElement = audioRefs.current.get(recordingId)
    if (!audioElement) return

    if (playingId === recordingId) {
      audioElement.pause()
      setPlayingId(null)
    } else {
      // Stop any currently playing audio
      if (playingId) {
        const currentAudio = audioRefs.current.get(playingId)
        if (currentAudio) currentAudio.pause()
      }

      audioElement.play()
      setPlayingId(recordingId)
    }
  }

  const downloadAudio = (recording: AudioRecording) => {
    const link = document.createElement("a")
    link.href = recording.url
    link.download = `recording-${recording.timestamp.getTime()}.webm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-3xl font-semibold text-center text-gray-900">What pages would you like to create today?</h1>

        <div className="space-y-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder="Describe the pages you want to create..."
              className="w-full h-32 p-4 pr-12 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="p-2 text-black hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              )}
              <button
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={`p-2 rounded-full transition-colors ${
                  isRecording
                    ? "text-red-500 bg-red-50 hover:bg-red-100"
                    : isTranscribing
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Mic className={`w-5 h-5 ${isRecording ? "animate-pulse" : ""}`} />
              </button>
            </div>
          </div>

          {/* Status Indicators */}
          {isRecording && (
            <div className="flex items-center justify-center space-x-2 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Recording...</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center space-x-2 text-blue-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Processing audio...</span>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center justify-center space-x-2 text-purple-500">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Transcribing audio...</span>
            </div>
          )}

          {/* Error Display */}
          {transcriptionError && (
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{transcriptionError}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const lastRecording = recordings[recordings.length - 1]
                    if (lastRecording) retryTranscription(lastRecording)
                  }}
                  className="text-sm text-red-600 hover:text-red-800 underline font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Audio Recordings */}
          {recordings.map((recording, index) => (
            <div key={recording.id} className="space-y-3">
              <div className="flex items-center justify-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <button
                  onClick={() => togglePlayback(recording.id)}
                  className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                >
                  {playingId === recording.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="text-sm text-green-700">
                  Recording {index + 1} - {recording.timestamp.toLocaleTimeString()}
                </span>
                <button
                  onClick={() => downloadAudio(recording)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
              <audio
                ref={(el) => {
                  if (el) {
                    audioRefs.current.set(recording.id, el)
                  } else {
                    audioRefs.current.delete(recording.id)
                  }
                }}
                src={recording.url}
                onEnded={() => setPlayingId(null)}
                className="hidden"
              />
            </div>
          ))}

          {hasPermission === false && (
            <div className="text-center text-red-500 text-sm">
              Microphone permission denied. Please enable microphone access to use voice recording.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
