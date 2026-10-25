export default function FaqAnswer({ text }) {
  return text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part
    const url = part.replace(/[.,!;:?)]+$/, '')
    return (
      <span key={index}>
        <a href={url}>{url}</a>
        {part.slice(url.length)}
      </span>
    )
  })
}
