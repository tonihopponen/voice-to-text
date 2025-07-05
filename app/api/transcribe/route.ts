import { type NextRequest, NextResponse } from "next/server"
import { experimental_transcribe as transcribe } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: NextRequest) {
  console.log("=== Transcription API called ===")

  try {
    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      console.log("No audio file provided")
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    console.log(`Audio file: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`)

    // Validate file size (25MB limit)
    if (audioFile.size > 25 * 1024 * 1024) {
      console.log("File size exceeds limit")
      return NextResponse.json({ error: "File size exceeds 25MB limit" }, { status: 400 })
    }

    // Convert File to Uint8Array for AI SDK
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioData = new Uint8Array(arrayBuffer)

    // Log request details
    const requestDetails = {
      model: "whisper-1",
      audioSize: audioData.length,
      audioType: audioFile.type,
      fileName: audioFile.name,
      language: "auto-detect",
      endpoint: "AI SDK transcribe",
    }
    console.log("Request to AI SDK:", requestDetails)

    console.log("Starting transcription with AI SDK...")

    // Use AI SDK for transcription
    const result = await transcribe({
      model: openai.transcription("whisper-1"),
      audio: audioData,
      language: undefined, // Let Whisper auto-detect and transcribe in original language
    })

    // Log response details
    const responseDetails = {
      text: result.text,
      textLength: result.text?.length || 0,
      success: true,
    }
    console.log("Response from AI SDK:", responseDetails)

    return NextResponse.json({
      text: result.text,
      success: true,
      debug: {
        request: requestDetails,
        response: responseDetails,
      },
    })
  } catch (error: any) {
    console.error("=== Transcription Error ===")
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)
    console.error("Full error:", error)

    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: `Transcription failed: ${error.message}`,
        details: error.stack,
        type: error.constructor.name,
        debug: {
          error: {
            message: error.message,
            type: error.constructor.name,
            stack: error.stack,
          },
        },
      },
      { status: 500 },
    )
  }
}
