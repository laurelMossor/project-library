import { VersionTag } from "../tag/VersionTag"

export const HeadingTitle = ({ title }: { title: string }) => {
    return (
        <div className="flex gap-2">
            <h1 className="text-3xl font-bold">{title}</h1>
            {/* <VersionTag /> */}
        </div>
    )
}