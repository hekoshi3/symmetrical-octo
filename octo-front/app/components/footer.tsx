import Image from "next/image"
import Link from "next/link"

export default function Footer() {
    return (
        <footer className="footer sm:footer-horizontal bg-neutral-950 text-base-content p-10 border-t border-neutral-700">
            <aside>
                <Image width="50" height="50" src={"/img/nacho.png"} alt={""} ></Image>
                <p>
                    AiHub
                    <br />
                    Created by Kortis | Renar | Hekoshi
                    <br />
                    <Link href={"https://spoons.su"} className="underline">Designed by Hekoshi</Link>
                </p>
            </aside>
            <nav>
                <h6 className="footer-title">AiHub</h6>
                <Link className="link link-hover" href={""}>Главная</Link >
                <Link className="link link-hover" href={""}>Модели</Link >
                <Link className="link link-hover" href={""}>Изображения</Link >
                {/*<Link className="link link-hover">Advertisement</Link >*/}
            </nav>
            <nav>
                <h6 className="footer-title">О нас</h6>
                <Link className="link link-hover" href={""}>Контакты</Link>
                <Link className="link link-hover" href={""}>Условия использования</Link >
                <Link className="link link-hover" href={""}>Политика конфиденциальности</Link >
                {/*<Link className="link link-hover" href={""}>Cookie policy</Link >*/}
            </nav>
        </footer>
    )
};