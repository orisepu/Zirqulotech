'use client'

import * as React from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import 'ckeditor5/ckeditor5.css'

type Props = { value: string; onChange: (v: string)=>void; height?: number }

export default function HtmlEditor({ value, onChange, height = 520 }: Props) {
  const editorClassRef = React.useRef<any>(null)   // ⬅️ guarda la clase aquí
  const pluginsRef = React.useRef<any[]>([])
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const m = await import('ckeditor5')
      if (cancelled) return

      // Clase del editor
      editorClassRef.current = m.ClassicEditor

      // Plugins mínimos que usas en la toolbar
      pluginsRef.current = [
        m.Essentials, m.Paragraph, m.Heading,
        m.Bold, m.Italic, m.Underline,
        m.Link, m.List,
        m.Alignment,
        m.Table, m.TableToolbar,
        m.BlockQuote
      ]

      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!ready) return null

  return (
    <div>
      <CKEditor
        editor={editorClassRef.current}   // ⬅️ pasas la clase, pero desde ref
        data={value}
        onChange={(_, ed) => onChange(ed.getData())}
        config={{
          licenseKey: 'GPL',
          plugins: pluginsRef.current,
          toolbar: [
            'heading','|',
            'bold','italic','underline','link','|',
            'bulletedList','numberedList','|',
            'insertTable','blockQuote','|',
            'alignment','|',
            'undo','redo'
          ],
          alignment: { options: [ 'left','center','right','justify' ] },
          table: { contentToolbar: ['tableColumn','tableRow','mergeTableCells'] }
        }}
      />

      <style jsx global>{`
        .ck-editor__editable_inline { min-height: ${height}px; }
      `}</style>
    </div>
  )
}
