import logoSrc from '../../assets/teacherspetlogo.png'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function LogoMark({
  alt = "Teacher's Pet logo",
  containerClassName = '',
  imgClassName = '',
}) {
  return (
    <div
      className={cx(
        'overflow-hidden bg-transparent flex items-center justify-center',
        containerClassName,
      )}
    >
      <img
        src={logoSrc}
        alt={alt}
        className={cx('w-full h-full object-contain', imgClassName)}
      />
    </div>
  )
}
