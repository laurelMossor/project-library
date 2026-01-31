import { VersionTag } from "../tag/VersionTag"

export const CollectionTitle = ({ title }: { title: string }) => {
    return (
        <div className="flex gap-2">
            <h1 className="text-3xl font-bold mb-4">{title}</h1>
            {/* <VersionTag /> */}
        </div>
    )
}