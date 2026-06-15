-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_evaluator_fkey" FOREIGN KEY ("evaluator") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
