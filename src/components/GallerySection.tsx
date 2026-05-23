import { motion } from "framer-motion";
import OptimizedImage from "@/components/OptimizedImage";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import galleryDj1 from "@/assets/gallery-dj-1.webp";
import galleryDj2 from "@/assets/gallery-dj-2.webp";
import galleryDj4 from "@/assets/gallery-dj-4.jpg";
import galleryDj5 from "@/assets/gallery-dj-5.jpg";

const images = [
{ src: galleryDj1, alt: "DJ deck with neon ON AIR sign", span: "row-span-2" },
{ src: gallery1, alt: "Vocal booth with condenser microphone", span: "" },
{ src: galleryDj2, alt: "Pioneer CDJ turntable close-up", span: "" },
{ src: galleryDj5, alt: "DJ booth with ON AIR neon and TV monitor", span: "col-span-2" },
{ src: galleryDj4, alt: "Studio with purple and red lighting", span: "row-span-2" },
{ src: gallery2, alt: "Outboard gear rack with VU meters", span: "" }];


const GallerySection = () => {
  return (
    <section id="gallery" className="py-28 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-20">
          
          <p className="text-muted-foreground font-body text-[11px] uppercase tracking-[0.3em] mb-4">Inside The Studio</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold chrome-text">
            GALLERY
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-[200px] md:auto-rows-[240px]">
          {images.map((img, i) =>
          <motion.div
            key={img.alt}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className={`card-premium relative overflow-hidden rounded-md group ${img.span}`}>
            
              <OptimizedImage
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 border-none" />
            
              
            </motion.div>
          )}
        </div>
      </div>
    </section>);

};

export default GallerySection;