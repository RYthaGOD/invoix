import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, EyeOff, Users, Info } from 'lucide-react';
import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';

interface PrivacyControlsProps {
    register: UseFormRegister<any>;
    watch: UseFormWatch<any>;
    setValue: UseFormSetValue<any>;
}

export function PrivacyControls({ register, watch, setValue }: PrivacyControlsProps) {
    const isEncrypted = watch("encryptWithArcium");

    return (
        <div className="space-y-4">
            <label className={`
                relative flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer group
                ${isEncrypted
                    ? 'bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}
            `}>
                <div className="pt-1">
                    <input
                        {...register("encryptWithArcium")}
                        type="checkbox"
                        className="w-5 h-5 rounded border-cyan-500/50 bg-cyan-950/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                    />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`font-semibold text-lg transition-colors ${isEncrypted ? 'text-cyan-400' : 'text-white'}`}>
                            Arcium Confidential Computing
                        </div>
                        {isEncrypted && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                                Active
                            </span>
                        )}
                    </div>
                    <div className="text-gray-400 text-sm leading-relaxed">
                        Encrypt invoice details using Multi-Party Execution Environment (MXE).
                        Only authorized wallets can decrypt the data inside the TEE.
                    </div>
                </div>
                <Lock className={`w-6 h-6 transition-colors ${isEncrypted ? 'text-cyan-400' : 'text-gray-600'}`} />
            </label>

            <AnimatePresence>
                {isEncrypted && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-2"
                    >
                        <div className="pl-6 border-l-2 border-cyan-500/20 space-y-4 py-2">
                            {/* Access List Visualization */}
                            <div className="bg-cyan-950/10 rounded-lg p-4 border border-cyan-500/10">
                                <h4 className="text-sm font-medium text-cyan-200 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Authorized Parties (Decryption Access)
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-sm text-cyan-100/80 bg-cyan-950/30 p-2 rounded border border-cyan-500/5">
                                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">Me</div>
                                        <span>Your Wallet (Invoicer)</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-cyan-100/80 bg-cyan-950/30 p-2 rounded border border-cyan-500/5">
                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300">C</div>
                                        <span>Customer Wallet (Invoicee)</span>
                                    </div>
                                </div>
                                <p className="text-xs text-cyan-500/60 mt-3 flex items-center gap-1.5">
                                    <EyeOff className="w-3 h-3" />
                                    Data remains encrypted on-chain. Validators cannot see details.
                                </p>
                            </div>

                            {/* Info Box */}
                            <div className="flex items-start gap-3 text-xs text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5">
                                <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <p>
                                    This will create a unique Program Derived Address (PDA) on-chain.
                                    You will be asked to sign an additional transaction to initialize the secure account.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
