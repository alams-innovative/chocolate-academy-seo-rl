import nodemailer from "nodemailer"
import { createCourseInquiry } from "@/lib/cms"

export async function POST(req) {
  const body = await req.json()
  const { fullName, email, phone, address, city, course, paymentMethod, message } = body

  // Persist the inquiry to the database for dashboard reporting (non-blocking on failure)
  try {
    await createCourseInquiry({
      full_name: fullName,
      email,
      phone,
      city,
      course,
      payment_method: paymentMethod,
      message: address ? `${message || ""}${message ? "\n" : ""}Address: ${address}` : message,
    })
  } catch (dbError) {
    console.error("[v0] Failed to save inquiry to DB:", dbError)
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Defense-in-depth: block file reads and URL fetches when resolving message
    // content/attachments. Safe here since we only send plain text with no attachments.
    disableFileAccess: true,
    disableUrlAccess: true,
  })

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: "alams.com.ai@gmail.com",
      subject: `New Course Registration: ${course}`,
      text: `
Name: ${fullName}
Email: ${email}
Phone: ${phone}
Address: ${address}
City: ${city}
Course: ${course}
Payment Method: ${paymentMethod}
Message: ${message}
      `,
    })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500 })
  }
}
