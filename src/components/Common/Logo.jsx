export default function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-x-2 ${className}`}>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-xl font-bold leading-none text-richblack-900">
        S
      </div>
      <span className="text-2xl font-bold tracking-tight text-white">
        StudyKaro
      </span>
    </div>
  )
}