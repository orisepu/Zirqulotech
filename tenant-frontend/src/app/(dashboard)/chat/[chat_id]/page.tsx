'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Mensaje = {
  autor: string
  texto: string
}

export default function ChatPage() {
  const { chat_id } = useParams()
  const socketRef = useRef<WebSocket | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (!chat_id) return

    const protocolo = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socketUrl = `${protocolo}://${window.location.host}/ws/chat/${chat_id}/`

    const socket = new WebSocket(socketUrl)
    socketRef.current = socket

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setMensajes((prev) => [...prev, data])
    }

    socket.onclose = () => {
      console.warn('Socket cerrado')
    }

    socket.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    return () => {
      socket.close()
    }
  }, [chat_id])

  const enviarMensaje = () => {
    if (!texto.trim()) return
    socketRef.current?.send(JSON.stringify({ texto }))
    setTexto('')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Chat #{chat_id}</h1>
      <div style={{ border: '1px solid #ccc', height: 300, overflowY: 'auto', padding: 10, marginBottom: 10 }}>
        {mensajes.map((msg, i) => (
          <div key={i}><strong>{msg.autor}:</strong> {msg.texto}</div>
        ))}
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe un mensaje..."
        style={{ width: '80%', marginRight: 10 }}
      />
      <button onClick={enviarMensaje}>Enviar</button>
    </div>
  )
}
