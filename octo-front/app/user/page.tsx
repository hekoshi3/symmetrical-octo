'use client'

import { useEffect, useState } from "react";
import { GalleryImage } from "../components/interfaces/GalleryImage";
import { imgCard } from "../components/imageCard";
import Image from "next/image";
import Link from "next/link";

export default function UserPage() {
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const res = await fetch("/api/getImages");
                if (!res.ok) throw new Error("Failed to fetch images");
                const images: GalleryImage[] = await res.json();
                setGallery(images.reverse());
            } catch (error) {
                console.error("Error loading gallery:", error);
            }
        };

        fetchGallery();
    }, []);
    function setClickedFunc(): Promise<unknown> {
        throw new Error("Function not implemented.");
    }

    return (
        <>
            <main className="flex w-screen">
                <div className="flex w-full flex-col min-h-screen">
                    <div className="h-1/4 border-b border-neutral-950 bg-[url(/img/nachosmile.jpg)] inset-0 bg-no-repeat bg-cover bg-center">
                        <Link href={"#"} className="btn bg-neutral-950 rounded-xl m-4 font-light">Редактировать</Link>
                    </div>
                    <div className="h-full overflow-y-scroll pt-4 pl-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
                            {gallery.slice(0, 14).map((img, index) => (imgCard(img, index, setClickedFunc)))}</div>
                    </div>
                </div>
                <div className="w-3xl bg-neutral-900">
                    <div className="w-full flex flex-col items-center justify-center pt-10">
                        <Image src={"/img/nacho.png"} width={128} height={128} alt="" className="rounded-full"></Image>
                        <p className="text-2xl font-mono">Hekoshi</p>
                        <p className="text-sm font-extralight">0 подписчиков</p>
                        <Link href={"#"} className="btn bg-neutral-950 rounded-xl m-4 font-light">Редактировать</Link>
                        <div className="m-5">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus id velit sapien. Curabitur mollis sollicitudin tellus, in tempor ligula ullamcorper et. Donec porta sodales ipsum, sit amet suscipit neque. In ullamcorper malesuada dolor sed malesuada. Nunc nulla ex, lobortis quis felis sed, cursus laoreet enim. Curabitur eget luctus enim. Integer nec lacinia erat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Suspendisse sagittis faucibus quam, luctus auctor odio faucibus in. Vestibulum at suscipit orci. Morbi id turpis ligula. Quisque vel nulla lectus.

                            In et odio erat. In eget velit eu ante varius tincidunt. In hac habitasse platea dictumst. Vivamus ut blandit eros, ac suscipit urna. Mauris aliquet ultrices pretium. Suspendisse potenti. Etiam id vehicula enim.

                            Morbi eu quam eu augue aliquet semper. Pellentesque id lacus efficitur, venenatis nibh vel, finibus nibh. Nullam vitae purus nec elit gravida lacinia. Praesent tincidunt mauris id orci malesuada rhoncus. Phasellus egestas pellentesque nisi, at aliquam libero porttitor ut. Fusce eget ligula sed eros cursus accumsan. Nullam a tortor quis diam facilisis varius at in risus. Vestibulum in nibh eu justo lacinia faucibus a ac dolor. Aenean luctus iaculis est sit amet consectetur. Nulla et consequat ante. Donec nec turpis magna. Cras et ipsum scelerisque orci maximus pretium. Phasellus ut erat quis odio ultrices consectetur. Duis sed lectus nec libero pharetra placerat. Aenean id dictum enim. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

                            Nullam condimentum vulputate neque quis porttitor. Mauris sed enim ex. Vivamus vulputate mauris et pharetra dignissim. Fusce tristique quis leo sit amet ornare. Curabitur cursus lacinia diam, a volutpat sapien tristique et. Aliquam placerat risus lorem, eget maximus metus porttitor id. In gravida pulvinar nulla id accumsan. Sed accumsan condimentum nulla, vitae imperdiet orci tincidunt ut. In quis libero dignissim, tincidunt dolor ac, cursus libero. Nulla ac aliquam mi, nec consequat neque. Pellentesque condimentum, turpis ac porta iaculis, lorem quam efficitur metus, et lobortis neque ante et augue. Nunc efficitur mauris non est egestas, a pellentesque nisi pretium. Nunc sed commodo est. Sed metus mauris, accumsan in turpis ac, dapibus tempus dolor. Etiam non sem quam.

                            Cras nec justo hendrerit, molestie est et, tincidunt quam. Integer ut rutrum nibh. Maecenas eu dolor vehicula, hendrerit nibh quis, fringilla diam. Sed sit amet ipsum vitae tellus faucibus viverra. Morbi eu imperdiet justo, non ultricies est. Quisque vel ultrices enim, ut vehicula sem. Cras quis metus sed ex condimentum dictum. Aenean ut sapien laoreet, scelerisque metus et, molestie ligula.
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}