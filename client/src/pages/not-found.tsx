import { Link } from "wouter";
import { motion } from "framer-motion";
import { Home, AlertTriangle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden px-6">
      {/* Background Effects */}
      <div className="absolute inset-0 gradient-hero opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-md"
      >
        {/* Animated 404 Badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="w-24 h-24 mx-auto mb-8 rounded-2xl glass-card flex items-center justify-center border border-white/10"
        >
          <AlertTriangle className="w-12 h-12 text-yellow-400" />
        </motion.div>

        {/* Error Code */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-8xl font-bold font-heading gradient-text mb-4"
        >
          404
        </motion.h1>

        {/* Message */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-heading font-semibold text-foreground mb-4"
        >
          Page Not Found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-8 leading-relaxed"
        >
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link href="/">
            <button className="btn-primary h-12 px-8 flex items-center justify-center gap-2 group w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          </Link>

          <Link href="/invoices">
            <button className="btn-secondary h-12 px-8 flex items-center justify-center gap-2 w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4" />
              Go to Dashboard
            </button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
