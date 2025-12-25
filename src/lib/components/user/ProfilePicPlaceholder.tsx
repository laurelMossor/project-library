export const ProfilePicPlaceholder = ({ initials }: { initials: string }) => {
    return (
        <div className="w-12 h-12 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600 font-medium text-sm">{initials}</span>
        </div>
    )
}